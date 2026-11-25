package reconciliation

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/receipt"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

const validationMessage = "لطفاً موارد الزامی پیش‌نمایش و انطباق را تکمیل کنید"

type store interface {
	Insert(ctx context.Context, rec Reconciliation) error
	Get(ctx context.Context, id string) (*Reconciliation, error)
	List(ctx context.Context, status string, page, pageSize int) ([]Reconciliation, int64, error)
	Replace(ctx context.Context, rec Reconciliation) error
	ClaimPending(ctx context.Context, id string) (bool, error)
}

type drugCatalog interface {
	All(ctx context.Context) ([]drug.Drug, error)
	Get(ctx context.Context, id string) (*drug.Drug, error)
}

type ttacLookup interface {
	LookupTTAC(ctx context.Context, q string) map[string]any
}

type batchCreator interface {
	CreateBatchCore(ctx context.Context, req expiry.CreateRequest, actorName string) (shelf.StockBatch, string, error)
}

type batchDeleter interface {
	DeleteBatch(ctx context.Context, id string) error
}

type cardexDeleter interface {
	Delete(ctx context.Context, id string) error
}

type shelfReader interface {
	ListBins(ctx context.Context) ([]shelf.Bin, error)
}

type receiptWriter interface {
	Insert(ctx context.Context, rec receipt.Receipt) error
	Delete(ctx context.Context, id string) error
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

type ttacPriceAdapter struct {
	drugs ttacLookup
}

func (a ttacPriceAdapter) ResolveApprovedPrice(ctx context.Context, irc, gtin string) int64 {
	if a.drugs == nil {
		return 0
	}
	for _, q := range []string{strings.TrimSpace(irc), strings.TrimSpace(gtin)} {
		if q == "" {
			continue
		}
		res := a.drugs.LookupTTAC(ctx, q)
		if status, _ := res["status"].(string); status == "found" {
			if prod, ok := res["product"].(drug.TtacProduct); ok && prod.PackageConsumerPrice > 0 {
				return prod.PackageConsumerPrice
			}
		}
	}
	return 0
}

type Service struct {
	repo     store
	drugs    drugCatalog
	prices   priceResolver
	batches  batchCreator
	deleter  batchDeleter
	cardex   cardexDeleter
	shelves  shelfReader
	receipts receiptWriter
	audit    auditWriter
	now      func() time.Time
}

func NewService(
	repo store,
	drugs drugCatalog,
	ttacSvc ttacLookup,
	batches batchCreator,
	deleter batchDeleter,
	movements cardexDeleter,
	shelves shelfReader,
	receipts receiptWriter,
	auditLog auditWriter,
) *Service {
	return &Service{
		repo:     repo,
		drugs:    drugs,
		prices:   ttacPriceAdapter{drugs: ttacSvc},
		batches:  batches,
		deleter:  deleter,
		cardex:   movements,
		shelves:  shelves,
		receipts: receipts,
		audit:    auditLog,
		now:      func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) UploadFile(ctx context.Context, filename string, data []byte, meta UploadMeta, actor requestctx.Actor) (ReconciliationView, error) {
	sheet, err := ParseSpreadsheet(filename, data)
	if err != nil {
		return ReconciliationView{}, errormap.Validation(err.Error(), map[string]string{"file": err.Error()})
	}

	templateID := strings.TrimSpace(meta.TemplateID)
	if templateID == "" {
		templateID = "hijrat"
	}
	mapping := DetectColumnMapping(sheet.Headers, templateID)
	extracted := ExtractRows(sheet.RawRows, mapping)
	if len(extracted) == 0 {
		return ReconciliationView{}, errormap.Validation("هیچ ردیف دارویی معتبری از فایل استخراج نشد", map[string]string{"file": "ستون‌های نام دارو یا بارکد خالی است"})
	}

	catalogDrugs, err := s.drugs.All(ctx)
	if err != nil {
		return ReconciliationView{}, err
	}
	reconciled := ReconcileRows(ctx, extracted, catalogDrugs, s.prices)

	now := s.now()
	todayISO := now.Format("2006-01-02")
	invoiceNo := strings.TrimSpace(meta.InvoiceNo)
	if invoiceNo == "" {
		invoiceNo = fmt.Sprintf("INV-%s-%02d", now.Format("20060102"), now.Second())
	}
	distributor := strings.TrimSpace(meta.Distributor)
	if distributor == "" {
		distributor = "پخش هجرت"
	}
	issuedAt := strings.TrimSpace(meta.IssuedAt)
	if issuedAt == "" {
		issuedAt = todayISO
	}
	receivedAt := strings.TrimSpace(meta.ReceivedAt)
	if receivedAt == "" {
		receivedAt = todayISO
	}
	warehouse := strings.TrimSpace(meta.WarehouseLabel)
	if warehouse == "" {
		warehouse = "انبار مرکزی"
	}

	rec := Reconciliation{
		ID:                 uuid.NewString(),
		Status:             StatusMapped,
		CurrentStep:        2,
		FileName:           strings.TrimSpace(filename),
		FileSizeBytes:      int64(len(data)),
		InvoiceNo:          invoiceNo,
		Distributor:        distributor,
		IssuedAt:           issuedAt,
		ReceivedAt:         receivedAt,
		WarehouseLabel:     warehouse,
		DiscountRial:       meta.DiscountRial,
		VatRial:            meta.VatRial,
		TemplateID:         templateID,
		Headers:            sheet.Headers,
		ColumnLabels:       sheet.ColumnLabels,
		RawRows:            sheet.RawRows,
		Mapping:            mapping,
		Rows:               reconciled,
		QuarantineOnIntake: true,
		CreatedBy: CreatedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Insert(ctx, rec); err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) List(ctx context.Context, status string, p pagination.Params) (pagination.Result[HistoryItem], error) {
	items, total, err := s.repo.List(ctx, status, p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[HistoryItem]{}, err
	}
	out := make([]HistoryItem, 0, len(items))
	for _, rec := range items {
		out = append(out, HistoryItem{
			ID:                 rec.ID,
			Status:             rec.Status,
			CurrentStep:        rec.CurrentStep,
			FileName:           rec.FileName,
			FileSizeBytes:      rec.FileSizeBytes,
			InvoiceNo:          rec.InvoiceNo,
			Distributor:        rec.Distributor,
			TemplateID:         rec.TemplateID,
			CreatedReceiptID:   rec.CreatedReceiptID,
			QuarantineOnIntake: rec.QuarantineOnIntake,
			CreatedAt:          rec.CreatedAt,
			UpdatedAt:          rec.UpdatedAt,
			ConfirmedAt:        rec.ConfirmedAt,
			Summary:            ComputeSummary(rec.Rows, rec.DiscountRial, rec.VatRial),
		})
	}
	return pagination.Wrap(out, int(total), p.Page, p.PageSize), nil
}

func (s *Service) Get(ctx context.Context, id string) (ReconciliationView, error) {
	rec, err := s.load(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) UpdateMapping(ctx context.Context, id string, req MappingRequest) (ReconciliationView, error) {
	rec, err := s.loadEditable(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	if req.TemplateID != nil && strings.TrimSpace(*req.TemplateID) != "" {
		rec.TemplateID = strings.TrimSpace(*req.TemplateID)
	}
	if req.Mapping != nil {
		if err := validateMapping(*req.Mapping, len(rec.Headers)); err != nil {
			return ReconciliationView{}, err
		}
		rec.Mapping = *req.Mapping
	}
	if len(rec.RawRows) > 0 {
		extracted := ExtractRows(rec.RawRows, rec.Mapping)
		if len(extracted) == 0 {
			return ReconciliationView{}, errormap.Validation("با نگاشت فعلی ردیف معتبری استخراج نشد", map[string]string{"mapping": "ستون نام کالا یا بارکد را بررسی کنید"})
		}
		drugs, err := s.drugs.All(ctx)
		if err != nil {
			return ReconciliationView{}, err
		}
		rec.Rows = ReconcileRows(ctx, extracted, drugs, s.prices)
	}
	rec.Status = StatusMapped
	if req.GoToStep3 {
		rec.CurrentStep = 3
	}
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) Rematch(ctx context.Context, id string, req RematchRequest) (ReconciliationView, error) {
	rec, err := s.loadEditable(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	if strings.TrimSpace(req.RowID) != "" && strings.TrimSpace(req.DrugID) != "" {
		idx := findRowIndex(rec.Rows, req.RowID)
		if idx < 0 {
			return ReconciliationView{}, errormap.NotFound("ردیف فاکتور یافت نشد")
		}
		d, err := s.drugs.Get(ctx, strings.TrimSpace(req.DrugID))
		if err != nil {
			return ReconciliationView{}, err
		}
		if d == nil {
			return ReconciliationView{}, errormap.NotFound("داروی انتخاب‌شده در کاتالوگ یافت نشد")
		}
		rec.Rows[idx].DrugID = d.ID
	}
	drugs, err := s.drugs.All(ctx)
	if err != nil {
		return ReconciliationView{}, err
	}
	rec.Rows = ReconcileRows(ctx, rec.Rows, drugs, s.prices)
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) PatchDraft(ctx context.Context, id string, patch DraftPatch) (ReconciliationView, error) {
	rec, err := s.loadEditable(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	if patch.InvoiceNo != nil {
		rec.InvoiceNo = strings.TrimSpace(*patch.InvoiceNo)
	}
	if patch.Distributor != nil {
		rec.Distributor = strings.TrimSpace(*patch.Distributor)
	}
	if patch.IssuedAt != nil {
		rec.IssuedAt = strings.TrimSpace(*patch.IssuedAt)
	}
	if patch.ReceivedAt != nil {
		rec.ReceivedAt = strings.TrimSpace(*patch.ReceivedAt)
	}
	if patch.WarehouseLabel != nil {
		rec.WarehouseLabel = strings.TrimSpace(*patch.WarehouseLabel)
	}
	if patch.DiscountRial != nil {
		if *patch.DiscountRial < 0 {
			return ReconciliationView{}, errormap.Validation("تخفیف نمی‌تواند منفی باشد", map[string]string{"discountRial": "مقدار نامعتبر"})
		}
		rec.DiscountRial = *patch.DiscountRial
	}
	if patch.VatRial != nil {
		if *patch.VatRial < 0 {
			return ReconciliationView{}, errormap.Validation("مالیات نمی‌تواند منفی باشد", map[string]string{"vatRial": "مقدار نامعتبر"})
		}
		rec.VatRial = *patch.VatRial
	}
	if patch.QuarantineOnIntake != nil {
		rec.QuarantineOnIntake = *patch.QuarantineOnIntake
	}
	if patch.CurrentStep != nil {
		step := *patch.CurrentStep
		if step < 1 || step > 3 {
			return ReconciliationView{}, errormap.Validation("شماره مرحله نامعتبر است", map[string]string{"currentStep": "مرحله نامعتبر است"})
		}
		rec.CurrentStep = step
	}
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) PatchRow(ctx context.Context, id, rowID string, patch RowPatch, actor requestctx.Actor) (ReconciliationView, error) {
	rec, err := s.loadEditable(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	idx := findRowIndex(rec.Rows, rowID)
	if idx < 0 {
		return ReconciliationView{}, errormap.NotFound("ردیف فاکتور یافت نشد")
	}

	row := rec.Rows[idx]
	if patch.DrugID != nil {
		row.DrugID = strings.TrimSpace(*patch.DrugID)
	}
	if patch.ExcelName != nil {
		row.ExcelName = strings.TrimSpace(*patch.ExcelName)
	}
	if patch.GTIN != nil {
		row.GTIN = normalizeCode(*patch.GTIN)
	}
	if patch.IRC != nil {
		row.IRC = normalizeCode(*patch.IRC)
	}
	if patch.BatchNo != nil {
		row.BatchNo = strings.TrimSpace(*patch.BatchNo)
	}
	if patch.ExpiryRaw != nil {
		iso, jalali := ParseFlexibleDate(*patch.ExpiryRaw)
		if iso == "" {
			return ReconciliationView{}, errormap.Validation("فرمت تاریخ انقضا نامعتبر است (مثال: 1405/02/15)", map[string]string{"expiryRaw": "تاریخ نامعتبر است"})
		}
		row.ExpiryISO = iso
		row.ExpiryRaw = jalali
	} else if patch.ExpiryISO != nil {
		iso, jalali := ParseFlexibleDate(*patch.ExpiryISO)
		if iso == "" {
			return ReconciliationView{}, errormap.Validation("فرمت تاریخ انقضا نامعتبر است", map[string]string{"expiryISO": "تاریخ نامعتبر است"})
		}
		row.ExpiryISO = iso
		row.ExpiryRaw = jalali
	}
	if patch.Quantity != nil {
		if *patch.Quantity <= 0 {
			return ReconciliationView{}, errormap.Validation("تعداد باید بزرگ‌تر از صفر باشد", map[string]string{"quantity": "تعداد نامعتبر است"})
		}
		row.Quantity = *patch.Quantity
	}
	if patch.UnitLabel != nil && strings.TrimSpace(*patch.UnitLabel) != "" {
		row.UnitLabel = strings.TrimSpace(*patch.UnitLabel)
	}
	if patch.BuyPriceRial != nil {
		if *patch.BuyPriceRial < 0 {
			return ReconciliationView{}, errormap.Validation("قیمت خرید نمی‌تواند منفی باشد", map[string]string{"buyPriceRial": "قیمت نامعتبر است"})
		}
		row.BuyPriceRial = *patch.BuyPriceRial
	}
	if patch.ConsumerPriceRial != nil {
		if *patch.ConsumerPriceRial < 0 {
			return ReconciliationView{}, errormap.Validation("قیمت مصرف‌کننده نمی‌تواند منفی باشد", map[string]string{"consumerPriceRial": "قیمت نامعتبر است"})
		}
		row.ConsumerPriceRial = *patch.ConsumerPriceRial
	}
	if patch.LocationLabel != nil {
		row.LocationLabel = strings.TrimSpace(*patch.LocationLabel)
	}
	if patch.BinID != nil {
		row.BinID = strings.TrimSpace(*patch.BinID)
	}
	if patch.PriceApproved != nil {
		row.PriceApproved = *patch.PriceApproved
		if *patch.PriceApproved {
			row.PriceApprovedBy = actor.Name
		} else {
			row.PriceApprovedBy = ""
		}
	}

	drugs, err := s.drugs.All(ctx)
	if err != nil {
		return ReconciliationView{}, err
	}
	catalogIdx := buildDrugIndex(drugs)
	rec.Rows[idx] = evaluateRow(ctx, row, catalogIdx, s.prices, map[string]int64{})
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) DeleteRow(ctx context.Context, id, rowID string) (ReconciliationView, error) {
	rec, err := s.loadEditable(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	idx := findRowIndex(rec.Rows, rowID)
	if idx < 0 {
		return ReconciliationView{}, errormap.NotFound("ردیف فاکتور یافت نشد")
	}
	rec.Rows = append(rec.Rows[:idx], rec.Rows[idx+1:]...)
	if rec.Rows == nil {
		rec.Rows = []ReconciledRow{}
	}
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) Confirm(ctx context.Context, id string, actor requestctx.Actor, ip string) (ReconciliationView, error) {
	rec, err := s.load(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	if rec.Status == StatusConfirmed || rec.Status == StatusCancelled || rec.Status == "confirming" {
		return ReconciliationView{}, errormap.Conflict("این فاکتور قبلاً تایید یا لغو شده است")
	}
	if err := validateForConfirm(rec); err != nil {
		return ReconciliationView{}, err
	}

	claimed, err := s.repo.ClaimPending(ctx, id)
	if err != nil {
		return ReconciliationView{}, err
	}
	if !claimed {
		return ReconciliationView{}, errormap.Conflict("این فاکتور قبلاً تایید یا قفل شده است")
	}
	prevStatus := rec.Status

	defaultBinID, defaultLoc := s.resolveDefaultShelf(ctx, rec.QuarantineOnIntake)
	batchStatus := "active"
	if rec.QuarantineOnIntake {
		batchStatus = "quarantined"
	}

	createdBatches := make([]string, 0, len(rec.Rows))
	createdMovements := make([]string, 0, len(rec.Rows))
	receiptLines := make([]receipt.Line, 0, len(rec.Rows))
	controlled := false
	approvedMismatchCount := 0

	for _, row := range rec.Rows {
		if row.MatchStatus == RowPriceMismatch && row.PriceApproved {
			approvedMismatchCount++
		}
		loc := strings.TrimSpace(row.LocationLabel)
		binID := strings.TrimSpace(row.BinID)
		if loc == "" && binID == "" {
			loc = defaultLoc
			binID = defaultBinID
		}
		if loc == "" {
			loc = "A-03-2-04"
		}

		batch, movementID, err := s.batches.CreateBatchCore(ctx, expiry.CreateRequest{
			DrugID:            row.DrugID,
			BatchNo:           row.BatchNo,
			Expiry:            row.ExpiryISO,
			Quantity:          row.Quantity,
			UnitLabel:         row.UnitLabel,
			LocationLabel:     loc,
			BinID:             binID,
			Distributor:       rec.Distributor,
			InvoiceNo:         rec.InvoiceNo,
			BuyPriceRial:      int(row.BuyPriceRial),
			ConsumerPriceRial: int(row.ConsumerPriceRial),
			Status:            batchStatus,
		}, actor.Name)
		if err != nil {
			s.rollback(ctx, createdBatches, createdMovements, "")
			s.revertStatus(ctx, rec, prevStatus)
			return ReconciliationView{}, err
		}
		createdBatches = append(createdBatches, batch.ID)
		if movementID != "" {
			createdMovements = append(createdMovements, movementID)
		}
		if batch.IsControlled {
			controlled = true
		}

		receiptLines = append(receiptLines, receipt.Line{
			ID:                uuid.NewString(),
			DrugID:            row.DrugID,
			NameFa:            batch.NameFa,
			GTIN:              row.GTIN,
			IRC:               row.IRC,
			BatchNo:           row.BatchNo,
			Expiry:            row.ExpiryISO,
			Quantity:          row.Quantity,
			UnitLabel:         batch.UnitLabel,
			BuyPriceRial:      row.BuyPriceRial,
			ConsumerPriceRial: row.ConsumerPriceRial,
			LocationLabel:     batch.LocationLabel,
			BinID:             batch.BinID,
			Zone:              batch.Zone,
		})
	}

	now := s.now()
	receiptID := uuid.NewString()
	if s.receipts != nil {
		invReceipt := receipt.Receipt{
			ID:          receiptID,
			Status:      receipt.StatusConfirmed,
			CurrentStep: 3,
			Header: receipt.Header{
				InvoiceNo:      rec.InvoiceNo,
				Distributor:    rec.Distributor,
				IssuedAt:       rec.IssuedAt,
				ReceivedAt:     rec.ReceivedAt,
				WarehouseLabel: rec.WarehouseLabel,
				PurchaseType:   "official_ttac",
				DiscountRial:   rec.DiscountRial,
				VatRial:        rec.VatRial,
				Note:           "ایجادشده از تطبیق اکسل: " + rec.FileName,
			},
			Lines:           receiptLines,
			CreatedBatchIDs: createdBatches,
			CreatedBy: receipt.CreatedBy{
				UserID: actor.UserID,
				Name:   actor.Name,
				Role:   actor.Role,
			},
			CreatedAt:   now,
			UpdatedAt:   now,
			ConfirmedAt: &now,
		}
		if err := s.receipts.Insert(ctx, invReceipt); err != nil {
			s.rollback(ctx, createdBatches, createdMovements, "")
			s.revertStatus(ctx, rec, prevStatus)
			return ReconciliationView{}, err
		}
	}

	_, err = s.audit.Append(ctx, audit.AppendInput{
		Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action:      "stock_receipt",
		EntityType:  "invoice",
		EntityID:    rec.ID,
		EntityLabel: rec.InvoiceNo,
		Description: "تایید تطبیق اکسل فاکتور خرید و ایجاد رسید انبار",
		After: map[string]any{
			"invoiceNo":             rec.InvoiceNo,
			"receiptId":             receiptID,
			"createdBatchIds":       createdBatches,
			"rowCount":              len(rec.Rows),
			"quarantineOnIntake":    rec.QuarantineOnIntake,
			"approvedMismatchCount": approvedMismatchCount,
		},
		IP:                    ip,
		BranchID:              actor.BranchID,
		IsControlledSubstance: controlled,
	})
	if err != nil {
		s.rollback(ctx, createdBatches, createdMovements, receiptID)
		s.revertStatus(ctx, rec, prevStatus)
		return ReconciliationView{}, err
	}

	if approvedMismatchCount > 0 {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:                 audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:                "price_mod",
			EntityType:            "pricing",
			EntityID:              rec.ID,
			EntityLabel:           rec.InvoiceNo,
			Description:           "تایید مغایرت قیمت مصوب در تطبیق فاکتور توسط مسئول فنی",
			After:                 map[string]any{"approvedMismatchCount": approvedMismatchCount},
			Severity:              "warning",
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: controlled,
		})
	}

	rec.Status = StatusConfirmed
	rec.CurrentStep = 3
	rec.CreatedReceiptID = receiptID
	rec.CreatedBatchIDs = createdBatches
	rec.ConfirmedAt = &now
	rec.UpdatedAt = now
	if err := s.repo.Replace(ctx, rec); err != nil {
		s.rollback(ctx, createdBatches, createdMovements, receiptID)
		s.revertStatus(ctx, rec, prevStatus)
		return ReconciliationView{}, err
	}
	return toView(rec), nil
}

func (s *Service) resolveDefaultShelf(ctx context.Context, quarantine bool) (binID, locationLabel string) {
	if quarantine {
		return "", "Q-01-1-01"
	}
	if s.shelves != nil {
		bins, err := s.shelves.ListBins(ctx)
		if err == nil {
			for _, b := range bins {
				if !b.IsControlled && b.MacroLocation == "main" {
					return b.ID, b.Address
				}
			}
			if len(bins) > 0 {
				return bins[0].ID, bins[0].Address
			}
		}
	}
	return "", "A-03-2-04"
}

func (s *Service) rollback(ctx context.Context, batchIDs, movementIDs []string, receiptID string) {
	for _, id := range batchIDs {
		if s.deleter != nil {
			_ = s.deleter.DeleteBatch(ctx, id)
		}
	}
	for _, id := range movementIDs {
		if id != "" && s.cardex != nil {
			_ = s.cardex.Delete(ctx, id)
		}
	}
	if receiptID != "" && s.receipts != nil {
		_ = s.receipts.Delete(ctx, receiptID)
	}
}

func (s *Service) revertStatus(ctx context.Context, rec Reconciliation, prevStatus string) {
	rec.Status = prevStatus
	rec.ConfirmedAt = nil
	rec.CreatedReceiptID = ""
	rec.CreatedBatchIDs = nil
	rec.UpdatedAt = s.now()
	_ = s.repo.Replace(ctx, rec)
}

func (s *Service) load(ctx context.Context, id string) (Reconciliation, error) {
	rec, err := s.repo.Get(ctx, id)
	if err != nil {
		return Reconciliation{}, err
	}
	if rec == nil {
		return Reconciliation{}, errormap.NotFound("سند تطبیق فاکتور یافت نشد")
	}
	if rec.Rows == nil {
		rec.Rows = []ReconciledRow{}
	}
	return *rec, nil
}

func (s *Service) loadEditable(ctx context.Context, id string) (Reconciliation, error) {
	rec, err := s.load(ctx, id)
	if err != nil {
		return Reconciliation{}, err
	}
	if rec.Status == StatusConfirmed || rec.Status == StatusCancelled || rec.Status == "confirming" {
		return Reconciliation{}, errormap.Conflict("فاکتور تاییدشده قابل ویرایش نیست")
	}
	return rec, nil
}

func validateMapping(m ColumnMapping, colCount int) error {
	fields := map[string]string{}
	check := func(name string, idx int) {
		if idx < -1 || idx >= colCount {
			fields[name] = "ستون انتخاب‌شده خارج از محدوده فایل است"
		}
	}
	check("nameFa", m.NameFa)
	check("gtin", m.GTIN)
	check("irc", m.IRC)
	check("batchNo", m.BatchNo)
	check("expiry", m.Expiry)
	check("quantity", m.Quantity)
	check("buyPriceRial", m.BuyPriceRial)
	check("consumerPriceRial", m.ConsumerPriceRial)
	check("unitLabel", m.UnitLabel)

	if m.NameFa < 0 && m.GTIN < 0 && m.IRC < 0 {
		fields["nameFa"] = "حداقل یکی از ستون‌های نام کالا، بارکد یا IRC باید نگاشت شود"
	}
	if len(fields) > 0 {
		return errormap.Validation("تنظیمات نگاشت ستون‌ها معتبر نیست", fields)
	}
	return nil
}

func validateForConfirm(rec Reconciliation) error {
	if len(rec.Rows) == 0 {
		return errormap.Validation(validationMessage, map[string]string{"rows": "حداقل یک ردیف فاکتور برای ثبت الزامی است"})
	}
	if strings.TrimSpace(rec.InvoiceNo) == "" {
		return errormap.Validation(validationMessage, map[string]string{"invoiceNo": "شماره فاکتور الزامی است"})
	}
	if strings.TrimSpace(rec.Distributor) == "" {
		return errormap.Validation(validationMessage, map[string]string{"distributor": "نام شرکت پخش الزامی است"})
	}

	fields := map[string]string{}
	for _, r := range rec.Rows {
		if strings.TrimSpace(r.DrugID) == "" || r.MatchStatus == RowNewItem {
			fields["newItems"] = "ابتدا اقلام جدید بدون سابقه را در کاتالوگ ثبت یا از فاکتور حذف کنید"
			break
		}
	}
	for _, r := range rec.Rows {
		if r.MatchStatus == RowPriceMismatch && !r.PriceApproved {
			fields["priceMismatch"] = "ردیف‌های دارای مغایرت قیمت نیاز به تایید مسئول فنی دارند"
			break
		}
	}
	for _, r := range rec.Rows {
		if strings.TrimSpace(r.BatchNo) == "" {
			fields[fmt.Sprintf("rows[%d].batchNo", r.RowNumber)] = fmt.Sprintf("شماره سری ساخت ردیف %d خالی است", r.RowNumber)
			break
		}
		if strings.TrimSpace(r.ExpiryISO) == "" {
			fields[fmt.Sprintf("rows[%d].expiry", r.RowNumber)] = fmt.Sprintf("تاریخ انقضای ردیف %d معتبر نیست", r.RowNumber)
			break
		}
		if r.Quantity <= 0 {
			fields[fmt.Sprintf("rows[%d].quantity", r.RowNumber)] = fmt.Sprintf("تعداد ردیف %d باید بزرگ‌تر از صفر باشد", r.RowNumber)
			break
		}
	}
	if len(fields) > 0 {
		msg := validationMessage
		if v, ok := fields["newItems"]; ok {
			msg = v
		} else if v, ok := fields["priceMismatch"]; ok {
			msg = v
		}
		return errormap.Validation(msg, fields)
	}
	return nil
}

func toView(rec Reconciliation) ReconciliationView {
	if rec.Rows == nil {
		rec.Rows = []ReconciledRow{}
	}
	if rec.Headers == nil {
		rec.Headers = []string{}
	}
	if rec.ColumnLabels == nil {
		rec.ColumnLabels = []string{}
	}
	return ReconciliationView{
		Reconciliation: rec,
		Summary:        ComputeSummary(rec.Rows, rec.DiscountRial, rec.VatRial),
	}
}

func findRowIndex(rows []ReconciledRow, rowID string) int {
	for i, r := range rows {
		if r.ID == rowID {
			return i
		}
	}
	return -1
}
