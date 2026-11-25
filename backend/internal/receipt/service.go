package receipt

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/controlled"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

const validationMessage = "لطفاً فیلدهای الزامی را تکمیل کنید"

type receiptStore interface {
	Insert(ctx context.Context, rec Receipt) error
	Get(ctx context.Context, id string) (*Receipt, error)
	List(ctx context.Context, status string, page, pageSize int) ([]Receipt, int64, error)
	Replace(ctx context.Context, rec Receipt) error
	ClaimDraft(ctx context.Context, id string) (bool, error)
}

type drugStore interface {
	Get(ctx context.Context, id string) (*drug.Drug, error)
}

// BatchCreator inserts a stock batch and its inbound cardex line.
// Callers own audit; CreateBatchCore does not write an audit event.
// The string result is the cardex movement id for that batch.
type BatchCreator interface {
	CreateBatchCore(ctx context.Context, req expiry.CreateRequest, actorName string) (shelf.StockBatch, string, error)
}

type batchDeleter interface {
	DeleteBatch(ctx context.Context, id string) error
}

type cardexDeleter interface {
	Delete(ctx context.Context, id string) error
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

type controlledLedgerRecorder interface {
	RecordFromReceipt(ctx context.Context, in controlled.ReceiptHookInput) error
}

var (
	_ receiptStore  = (*Repository)(nil)
	_ drugStore     = (*drug.Repository)(nil)
	_ BatchCreator  = (*expiry.Service)(nil)
	_ batchDeleter  = (*shelf.Repository)(nil)
	_ cardexDeleter = (*cardex.Service)(nil)
	_ auditWriter   = (*audit.Service)(nil)
)

type Service struct {
	repo             receiptStore
	drugs            drugStore
	batches          BatchCreator
	deleter          batchDeleter
	cardex           cardexDeleter
	audit            auditWriter
	controlledLedger controlledLedgerRecorder
	now              func() time.Time
}

func NewService(repo receiptStore, drugs drugStore, batches BatchCreator, deleter batchDeleter, movements cardexDeleter, auditLog auditWriter) *Service {
	return &Service{
		repo:    repo,
		drugs:   drugs,
		batches: batches,
		deleter: deleter,
		cardex:  movements,
		audit:   auditLog,
		now:     func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) SetControlledLedger(recorder controlledLedgerRecorder) {
	s.controlledLedger = recorder
}

func (s *Service) Create(ctx context.Context, header Header, actor requestctx.Actor) (ReceiptView, error) {
	header = normalizeHeader(header)
	if fields := headerFields(header); len(fields) > 0 {
		return ReceiptView{}, errormap.Validation(validationMessage, fields)
	}
	now := s.now()
	rec := Receipt{
		ID:          uuid.NewString(),
		Status:      StatusDraft,
		CurrentStep: 1,
		Header:      header,
		Lines:       []Line{},
		CreatedBy: CreatedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Insert(ctx, rec); err != nil {
		return ReceiptView{}, err
	}
	return toView(rec), nil
}

func (s *Service) Get(ctx context.Context, id string) (ReceiptView, error) {
	rec, err := s.load(ctx, id)
	if err != nil {
		return ReceiptView{}, err
	}
	return toView(rec), nil
}

func (s *Service) List(ctx context.Context, status string, p pagination.Params) (pagination.Result[ReceiptView], error) {
	items, total, err := s.repo.List(ctx, status, p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[ReceiptView]{}, err
	}
	views := make([]ReceiptView, 0, len(items))
	for _, rec := range items {
		views = append(views, toView(rec))
	}
	return pagination.Wrap(views, int(total), p.Page, p.PageSize), nil
}

func (s *Service) Patch(ctx context.Context, id string, patch HeaderPatch) (ReceiptView, error) {
	rec, err := s.loadDraft(ctx, id)
	if err != nil {
		return ReceiptView{}, err
	}
	applyHeaderPatch(&rec, patch)
	rec.Header = normalizeHeader(rec.Header)
	fields := headerFields(rec.Header)
	if patch.CurrentStep != nil {
		step := *patch.CurrentStep
		if step < 1 || step > 3 {
			fields["currentStep"] = "مرحله نامعتبر است"
		} else {
			rec.CurrentStep = step
		}
	}
	if len(fields) > 0 {
		return ReceiptView{}, errormap.Validation(validationMessage, fields)
	}
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReceiptView{}, err
	}
	return toView(rec), nil
}

func (s *Service) AddLine(ctx context.Context, receiptID string, in LineInput) (ReceiptView, error) {
	rec, err := s.loadDraft(ctx, receiptID)
	if err != nil {
		return ReceiptView{}, err
	}
	if fields := lineFields(in.DrugID, in.BatchNo, in.Expiry, in.Quantity); len(fields) > 0 {
		return ReceiptView{}, errormap.Validation(validationMessage, fields)
	}
	d, err := s.drugs.Get(ctx, strings.TrimSpace(in.DrugID))
	if err != nil {
		return ReceiptView{}, err
	}
	if d == nil {
		return ReceiptView{}, errormap.NotFound("دارو یافت نشد")
	}
	rec.Lines = append(rec.Lines, lineFromDrug(in, d))
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReceiptView{}, err
	}
	return toView(rec), nil
}

func (s *Service) PatchLine(ctx context.Context, receiptID, lineID string, patch LinePatch) (ReceiptView, error) {
	rec, err := s.loadDraft(ctx, receiptID)
	if err != nil {
		return ReceiptView{}, err
	}
	idx := lineIndex(rec.Lines, lineID)
	if idx < 0 {
		return ReceiptView{}, errormap.NotFound("قلم فاکتور یافت نشد")
	}
	line := rec.Lines[idx]
	if patch.DrugID != nil {
		nextID := strings.TrimSpace(*patch.DrugID)
		if nextID == "" {
			line.DrugID = ""
		} else {
			d, err := s.drugs.Get(ctx, nextID)
			if err != nil {
				return ReceiptView{}, err
			}
			if d == nil {
				return ReceiptView{}, errormap.NotFound("دارو یافت نشد")
			}
			changed := line.DrugID != d.ID
			line.DrugID = d.ID
			line.NameFa = d.NameFa
			if patch.GTIN == nil && (changed || strings.TrimSpace(line.GTIN) == "") {
				line.GTIN = d.GTIN
			}
			if patch.UnitLabel == nil && (changed || strings.TrimSpace(line.UnitLabel) == "") {
				if d.UnitLabel != "" {
					line.UnitLabel = d.UnitLabel
				} else {
					line.UnitLabel = "عدد"
				}
			}
		}
	}
	applyLinePatch(&line, patch)
	if fields := lineFields(line.DrugID, line.BatchNo, line.Expiry, line.Quantity); len(fields) > 0 {
		return ReceiptView{}, errormap.Validation(validationMessage, fields)
	}
	rec.Lines[idx] = line
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReceiptView{}, err
	}
	return toView(rec), nil
}

func (s *Service) DeleteLine(ctx context.Context, receiptID, lineID string) (ReceiptView, error) {
	rec, err := s.loadDraft(ctx, receiptID)
	if err != nil {
		return ReceiptView{}, err
	}
	idx := lineIndex(rec.Lines, lineID)
	if idx < 0 {
		return ReceiptView{}, errormap.NotFound("قلم فاکتور یافت نشد")
	}
	rec.Lines = append(rec.Lines[:idx], rec.Lines[idx+1:]...)
	if rec.Lines == nil {
		rec.Lines = []Line{}
	}
	rec.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, rec); err != nil {
		return ReceiptView{}, err
	}
	return toView(rec), nil
}

func (s *Service) Confirm(ctx context.Context, id string, actor requestctx.Actor, ip string) (ReceiptView, error) {
	rec, err := s.load(ctx, id)
	if err != nil {
		return ReceiptView{}, err
	}
	if rec.Status != StatusDraft {
		return ReceiptView{}, errormap.Conflict("فقط پیش‌نویس قابل تایید است")
	}
	if len(rec.Lines) == 0 {
		return ReceiptView{}, errormap.Validation(validationMessage, map[string]string{
			"lines": "حداقل یک قلم الزامی است",
		})
	}
	if fields := locationFields(rec.Lines); len(fields) > 0 {
		return ReceiptView{}, errormap.Validation(validationMessage, fields)
	}

	claimed, err := s.repo.ClaimDraft(ctx, id)
	if err != nil {
		return ReceiptView{}, err
	}
	if !claimed {
		return ReceiptView{}, errormap.Conflict("فقط پیش‌نویس قابل تایید است")
	}

	created := make([]string, 0, len(rec.Lines))
	movements := make([]string, 0, len(rec.Lines))
	controlledBatches := make([]shelf.StockBatch, 0)
	controlledFlag := false
	for _, line := range rec.Lines {
		batch, movementID, err := s.batches.CreateBatchCore(ctx, batchRequest(rec.Header, line), actor.Name)
		if err != nil {
			s.rollbackCreated(ctx, created, movements)
			s.revertToDraft(ctx, rec)
			return ReceiptView{}, err
		}
		created = append(created, batch.ID)
		if movementID != "" {
			movements = append(movements, movementID)
		}
		if batch.IsControlled {
			controlledFlag = true
			controlledBatches = append(controlledBatches, batch)
		}
	}

	_, err = s.audit.Append(ctx, audit.AppendInput{
		Actor:                 audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action:                "stock_receipt",
		EntityType:            "receipt",
		EntityID:              rec.ID,
		EntityLabel:           rec.Header.InvoiceNo,
		Description:           "تایید فاکتور ورودی",
		After:                 map[string]any{"invoiceNo": rec.Header.InvoiceNo, "createdBatchIds": created, "lineCount": len(rec.Lines)},
		IP:                    ip,
		BranchID:              actor.BranchID,
		IsControlledSubstance: controlledFlag,
	})
	if err != nil {
		s.rollbackCreated(ctx, created, movements)
		s.revertToDraft(ctx, rec)
		return ReceiptView{}, err
	}

	now := s.now()
	rec.Status = StatusConfirmed
	rec.CreatedBatchIDs = created
	rec.ConfirmedAt = &now
	rec.UpdatedAt = now
	if err := s.repo.Replace(ctx, rec); err != nil {
		s.rollbackCreated(ctx, created, movements)
		s.revertToDraft(ctx, rec)
		return ReceiptView{}, err
	}
	if s.controlledLedger != nil {
		for _, batch := range controlledBatches {
			_ = s.controlledLedger.RecordFromReceipt(ctx, controlled.ReceiptHookInput{
				ReceiptID:     rec.ID,
				InvoiceNo:     rec.Header.InvoiceNo,
				Distributor:   rec.Header.Distributor,
				DrugID:        batch.DrugID,
				DrugNameFa:    batch.NameFa,
				UnitLabel:     batch.UnitLabel,
				Quantity:      batch.Quantity,
				BatchID:       batch.ID,
				BatchNo:       batch.BatchNo,
				Expiry:        batch.Expiry,
				LocationLabel: batch.LocationLabel,
				Actor:         actor,
				At:            now,
			})
		}
	}
	return toView(rec), nil
}

func (s *Service) rollbackCreated(ctx context.Context, batchIDs, movementIDs []string) {
	for _, id := range batchIDs {
		_ = s.deleter.DeleteBatch(ctx, id)
	}
	for _, id := range movementIDs {
		if id == "" || s.cardex == nil {
			continue
		}
		_ = s.cardex.Delete(ctx, id)
	}
}

func (s *Service) revertToDraft(ctx context.Context, rec Receipt) {
	rec.Status = StatusDraft
	rec.ConfirmedAt = nil
	rec.CreatedBatchIDs = nil
	rec.UpdatedAt = s.now()
	_ = s.repo.Replace(ctx, rec)
}

func (s *Service) load(ctx context.Context, id string) (Receipt, error) {
	rec, err := s.repo.Get(ctx, id)
	if err != nil {
		return Receipt{}, err
	}
	if rec == nil {
		return Receipt{}, errormap.NotFound("رسید یافت نشد")
	}
	if rec.Lines == nil {
		rec.Lines = []Line{}
	}
	return *rec, nil
}

func (s *Service) loadDraft(ctx context.Context, id string) (Receipt, error) {
	rec, err := s.load(ctx, id)
	if err != nil {
		return Receipt{}, err
	}
	if rec.Status != StatusDraft {
		return Receipt{}, errormap.Conflict("فقط پیش‌نویس قابل ویرایش است")
	}
	return rec, nil
}

func toView(rec Receipt) ReceiptView {
	if rec.Lines == nil {
		rec.Lines = []Line{}
	}
	gross, net := ComputeTotals(rec.Lines, rec.Header.DiscountRial, rec.Header.VatRial)
	return ReceiptView{Receipt: rec, GrossRial: gross, NetRial: net}
}

func normalizeHeader(h Header) Header {
	h.InvoiceNo = strings.TrimSpace(h.InvoiceNo)
	h.Distributor = strings.TrimSpace(h.Distributor)
	h.IssuedAt = strings.TrimSpace(h.IssuedAt)
	h.ReceivedAt = strings.TrimSpace(h.ReceivedAt)
	h.WarehouseLabel = strings.TrimSpace(h.WarehouseLabel)
	h.PurchaseType = strings.TrimSpace(h.PurchaseType)
	h.Note = strings.TrimSpace(h.Note)
	return h
}

func headerFields(h Header) map[string]string {
	fields := map[string]string{}
	if h.InvoiceNo == "" {
		fields["invoiceNo"] = "شماره فاکتور الزامی است"
	}
	if h.Distributor == "" {
		fields["distributor"] = "شرکت پخش الزامی است"
	}
	if h.IssuedAt == "" {
		fields["issuedAt"] = "تاریخ صدور الزامی است"
	}
	if h.ReceivedAt == "" {
		fields["receivedAt"] = "تاریخ دریافت الزامی است"
	}
	if h.WarehouseLabel == "" {
		fields["warehouseLabel"] = "انبار الزامی است"
	}
	if !allowedPurchase(h.PurchaseType) {
		fields["purchaseType"] = "نوع خرید نامعتبر است"
	}
	return fields
}

func allowedPurchase(v string) bool {
	switch v {
	case "official_ttac", "official", "other":
		return true
	default:
		return false
	}
}

func locationFields(lines []Line) map[string]string {
	fields := map[string]string{}
	for i, line := range lines {
		if strings.TrimSpace(line.LocationLabel) == "" && strings.TrimSpace(line.BinID) == "" {
			fields[fmt.Sprintf("lines[%d].locationLabel", i)] = "محل قفسه الزامی است"
		}
	}
	return fields
}

func batchRequest(h Header, line Line) expiry.CreateRequest {
	return expiry.CreateRequest{
		DrugID:            line.DrugID,
		BatchNo:           line.BatchNo,
		Expiry:            line.Expiry,
		Quantity:          line.Quantity,
		UnitLabel:         line.UnitLabel,
		LocationLabel:     line.LocationLabel,
		BinID:             line.BinID,
		Distributor:       h.Distributor,
		InvoiceNo:         h.InvoiceNo,
		BuyPriceRial:      int(line.BuyPriceRial),
		ConsumerPriceRial: int(line.ConsumerPriceRial),
	}
}

func lineFields(drugID, batchNo, expiry string, quantity int) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(drugID) == "" {
		fields["drugId"] = "شناسه دارو الزامی است"
	}
	if strings.TrimSpace(batchNo) == "" {
		fields["batchNo"] = "شماره سری ساخت الزامی است"
	}
	if strings.TrimSpace(expiry) == "" {
		fields["expiry"] = "تاریخ انقضا الزامی است"
	}
	if quantity <= 0 {
		fields["quantity"] = "تعداد باید بزرگ‌تر از صفر باشد"
	}
	return fields
}

func lineFromDrug(in LineInput, d *drug.Drug) Line {
	unit := strings.TrimSpace(in.UnitLabel)
	if unit == "" {
		unit = strings.TrimSpace(d.UnitLabel)
	}
	if unit == "" {
		unit = "عدد"
	}
	gtin := strings.TrimSpace(in.GTIN)
	if gtin == "" {
		gtin = d.GTIN
	}
	return Line{
		ID:                uuid.NewString(),
		DrugID:            d.ID,
		NameFa:            d.NameFa,
		GTIN:              gtin,
		IRC:               strings.TrimSpace(in.IRC),
		BatchNo:           strings.TrimSpace(in.BatchNo),
		Expiry:            strings.TrimSpace(in.Expiry),
		Quantity:          in.Quantity,
		UnitLabel:         unit,
		BuyPriceRial:      in.BuyPriceRial,
		ConsumerPriceRial: in.ConsumerPriceRial,
		LocationLabel:     strings.TrimSpace(in.LocationLabel),
		BinID:             strings.TrimSpace(in.BinID),
		Zone:              strings.TrimSpace(in.Zone),
	}
}

func applyHeaderPatch(rec *Receipt, patch HeaderPatch) {
	if patch.InvoiceNo != nil {
		rec.Header.InvoiceNo = *patch.InvoiceNo
	}
	if patch.Distributor != nil {
		rec.Header.Distributor = *patch.Distributor
	}
	if patch.IssuedAt != nil {
		rec.Header.IssuedAt = *patch.IssuedAt
	}
	if patch.ReceivedAt != nil {
		rec.Header.ReceivedAt = *patch.ReceivedAt
	}
	if patch.WarehouseLabel != nil {
		rec.Header.WarehouseLabel = *patch.WarehouseLabel
	}
	if patch.PurchaseType != nil {
		rec.Header.PurchaseType = *patch.PurchaseType
	}
	if patch.DiscountRial != nil {
		rec.Header.DiscountRial = *patch.DiscountRial
	}
	if patch.VatRial != nil {
		rec.Header.VatRial = *patch.VatRial
	}
	if patch.Note != nil {
		rec.Header.Note = *patch.Note
	}
}

func applyLinePatch(line *Line, patch LinePatch) {
	if patch.BatchNo != nil {
		line.BatchNo = strings.TrimSpace(*patch.BatchNo)
	}
	if patch.Expiry != nil {
		line.Expiry = strings.TrimSpace(*patch.Expiry)
	}
	if patch.Quantity != nil {
		line.Quantity = *patch.Quantity
	}
	if patch.UnitLabel != nil {
		line.UnitLabel = strings.TrimSpace(*patch.UnitLabel)
	}
	if patch.BuyPriceRial != nil {
		line.BuyPriceRial = *patch.BuyPriceRial
	}
	if patch.ConsumerPriceRial != nil {
		line.ConsumerPriceRial = *patch.ConsumerPriceRial
	}
	if patch.GTIN != nil {
		line.GTIN = strings.TrimSpace(*patch.GTIN)
	}
	if patch.IRC != nil {
		line.IRC = strings.TrimSpace(*patch.IRC)
	}
	if patch.LocationLabel != nil {
		line.LocationLabel = strings.TrimSpace(*patch.LocationLabel)
	}
	if patch.BinID != nil {
		line.BinID = strings.TrimSpace(*patch.BinID)
	}
	if patch.Zone != nil {
		line.Zone = strings.TrimSpace(*patch.Zone)
	}
}

func lineIndex(lines []Line, id string) int {
	for i, line := range lines {
		if line.ID == id {
			return i
		}
	}
	return -1
}
