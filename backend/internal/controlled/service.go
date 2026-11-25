package controlled

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

const (
	validationMessage = "لطفاً فیلدهای الزامی دفترچه را تکمیل کنید"
	maxRegisterQty    = 10000
)

type ledgerStore interface {
	NextSeq(ctx context.Context) (int64, error)
	Insert(ctx context.Context, e Entry) error
	List(ctx context.Context, f ListFilter) ([]Entry, int64, error)
	AggregateStats(ctx context.Context, since time.Time) (AggregatedStats, error)
}

type drugStore interface {
	Get(ctx context.Context, id string) (*drug.Drug, error)
	List(ctx context.Context, f drug.ListFilter) ([]drug.Drug, int64, error)
}

type shelfStore interface {
	ListBins(ctx context.Context) ([]shelf.Bin, error)
	GetBin(ctx context.Context, id string) (*shelf.Bin, error)
	BatchesByDrug(ctx context.Context, drugID string) ([]shelf.StockBatch, error)
	AllBatches(ctx context.Context) ([]shelf.StockBatch, error)
	GetBatch(ctx context.Context, id string) (*shelf.StockBatch, error)
	InsertBatch(ctx context.Context, b shelf.StockBatch) error
	DeleteBatch(ctx context.Context, id string) error
	UpdateBatchQuantity(ctx context.Context, id string, quantity int) error
	UpdateBatchStatus(ctx context.Context, id, status string) error
}

type cardexWriter interface {
	Append(ctx context.Context, in cardex.AppendInput) (cardex.Movement, error)
	Delete(ctx context.Context, id string) error
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

var (
	_ ledgerStore  = (*Repository)(nil)
	_ drugStore    = (*drug.Repository)(nil)
	_ shelfStore   = (*shelf.Repository)(nil)
	_ cardexWriter = (*cardex.Service)(nil)
	_ auditWriter  = (*audit.Service)(nil)
)

type Service struct {
	repo   ledgerStore
	drugs  drugStore
	stock  shelfStore
	cardex cardexWriter
	audit  auditWriter
	now    func() time.Time
}

func NewService(repo ledgerStore, drugs drugStore, stock shelfStore, movements cardexWriter, auditLog auditWriter) *Service {
	return &Service{
		repo:   repo,
		drugs:  drugs,
		stock:  stock,
		cardex: movements,
		audit:  auditLog,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) List(ctx context.Context, q ListQuery) (ListResponse, error) {
	items, total, err := s.repo.List(ctx, ListFilter{
		DrugID:   strings.TrimSpace(q.DrugID),
		TxType:   strings.TrimSpace(q.TxType),
		Search:   strings.TrimSpace(q.Search),
		From:     q.From,
		To:       q.To,
		SortBy:   q.SortBy,
		SortDir:  q.SortDir,
		Page:     q.Page,
		PageSize: q.PageSize,
	})
	if err != nil {
		return ListResponse{}, err
	}

	vaultItems, vaultBins, totalVaultBalance, err := s.loadVaultSnapshot(ctx)
	if err != nil {
		return ListResponse{}, err
	}

	since := s.now().Add(-30 * 24 * time.Hour)
	stats, err := s.repo.AggregateStats(ctx, since)
	if err != nil {
		return ListResponse{}, err
	}

	dtos := make([]EntryDTO, 0, len(items))
	for _, item := range items {
		dtos = append(dtos, ToDTO(item))
	}

	lastAuditAt := ""
	if stats.LastTimestamp != nil {
		lastAuditAt = stats.LastTimestamp.UTC().Format(time.RFC3339)
	}

	return ListResponse{
		Result: pagination.Wrap(dtos, int(total), q.Page, q.PageSize),
		KPIs: KPIs{
			TotalVaultBalance:       totalVaultBalance,
			ControlledDrugCount:     len(vaultItems),
			MonthInflow:             stats.MonthInflow,
			MonthInflowShipments:    stats.MonthInflowShipments,
			MonthOutflow:            stats.MonthOutflow,
			ActivePrescriptionCount: stats.ActivePrescriptionCount,
			WasteDestroyedCount:     stats.WasteDestroyedCount,
			TotalEntries:            stats.TotalEntries,
			ReconciliationPct:       100,
			LastAuditAt:             lastAuditAt,
		},
		VaultItems: vaultItems,
		VaultBins:  vaultBins,
	}, nil
}

func (s *Service) Register(ctx context.Context, req CreateRequest, actor requestctx.Actor, ip string) (EntryDTO, error) {
	req = normalizeRequest(req)
	if fields := validateCreateRequest(req); len(fields) > 0 {
		return EntryDTO{}, errormap.Validation(validationMessage, fields)
	}

	d, err := s.drugs.Get(ctx, req.DrugID)
	if err != nil {
		return EntryDTO{}, err
	}
	if d == nil {
		return EntryDTO{}, errormap.NotFound("فرآورده دارویی یافت نشد")
	}
	if !d.IsControlled {
		return EntryDTO{}, errormap.Validation(validationMessage, map[string]string{
			"drugId": "این دارو در فهرست داروهای تحت کنترل / مخدر نیست",
		})
	}

	unit := strings.TrimSpace(d.UnitLabel)
	if unit == "" {
		unit = "عدد"
	}
	dosageStrength := strings.TrimSpace(strings.TrimSpace(d.DosageForm) + " " + strings.TrimSpace(d.Strength))

	var (
		batchID      string
		vaultAddress string
		qtyIn        int
		qtyOut       int
		wasteCount   int
		txSubLabel   string
		cardexType   string
		cardexIn     int
		cardexOut    int
		auditAction  string
		auditDesc    string
		severity     = "info"
		rollbackFn   func()
	)

	switch req.TxType {
	case TxInDistributor:
		bin, err := s.resolveVaultBin(ctx, req.BinID)
		if err != nil {
			return EntryDTO{}, err
		}
		vaultAddress = bin.Address
		qtyIn = req.Quantity
		txSubLabel = "ورود محموله دولتی"
		cardexType = "inbound"
		cardexIn = req.Quantity
		auditAction = "controlled_substance_entry"
		auditDesc = fmt.Sprintf("ثبت ورود محموله سهمیه‌ای %s (%d %s)", d.NameFa, req.Quantity, unit)

		bID, undo, err := s.applyInflowStock(ctx, d, bin, req, unit)
		if err != nil {
			return EntryDTO{}, err
		}
		batchID = bID
		rollbackFn = undo

	case TxOutPrescription:
		batch, undo, err := s.applyOutflowStock(ctx, d.ID, req.BatchID, req.BatchNo, req.Quantity)
		if err != nil {
			return EntryDTO{}, err
		}
		batchID = batch.ID
		req.BatchNo = batch.BatchNo
		req.Expiry = batch.Expiry
		vaultAddress = batch.LocationLabel
		qtyOut = req.Quantity
		txSubLabel = "خروج با نسخه الکترونیک"
		cardexType = "controlled_dispense"
		cardexOut = req.Quantity
		auditAction = "controlled_dispense"
		auditDesc = fmt.Sprintf("تحویل داروی تحت کنترل %s (%d %s)", d.NameFa, req.Quantity, unit)
		rollbackFn = undo

	case TxWasteReturn:
		wasteCount = req.Quantity
		auditAction = "controlled_substance_entry"
		severity = "warning"
		if req.WasteMode == WasteModeDamagedStock {
			batch, undo, err := s.applyOutflowStock(ctx, d.ID, req.BatchID, req.BatchNo, req.Quantity)
			if err != nil {
				return EntryDTO{}, err
			}
			batchID = batch.ID
			req.BatchNo = batch.BatchNo
			req.Expiry = batch.Expiry
			vaultAddress = batch.LocationLabel
			qtyOut = req.Quantity
			txSubLabel = "امحا / مرجوعی موجودی ناسالم"
			cardexType = "quarantine"
			cardexOut = req.Quantity
			auditDesc = fmt.Sprintf("امحا و خروج موجودی ناسالم %s (%d %s)", d.NameFa, req.Quantity, unit)
			rollbackFn = undo
		} else {
			req.WasteMode = WasteModeUsedAmpoule
			vaultAddress = s.defaultVaultAddress(ctx, d.ID)
			txSubLabel = "پلمب پوکه مصرف‌شده"
			cardexType = "adjustment"
			auditDesc = fmt.Sprintf("تحویل و پلمب پوکه مصرف‌شده %s (%d %s)", d.NameFa, req.Quantity, unit)
		}
	}

	now := s.now()
	var movementID string
	if s.cardex != nil {
		mov, err := s.cardex.Append(ctx, cardex.AppendInput{
			DrugID:    d.ID,
			Type:      cardexType,
			BatchNo:   req.BatchNo,
			QtyIn:     cardexIn,
			QtyOut:    cardexOut,
			ActorName: actor.Name,
			Note:      txSubLabel + " · کد پیگیری: " + req.TrackingCode,
			At:        now,
		})
		if err != nil {
			if rollbackFn != nil {
				rollbackFn()
			}
			return EntryDTO{}, err
		}
		movementID = mov.ID
	}

	balanceAfter, err := s.computeDrugVaultBalance(ctx, d.ID)
	if err != nil {
		s.compensate(ctx, rollbackFn, movementID)
		return EntryDTO{}, err
	}

	seqNo, err := s.repo.NextSeq(ctx)
	if err != nil {
		s.compensate(ctx, rollbackFn, movementID)
		return EntryDTO{}, err
	}

	entry := Entry{
		ID:                uuid.NewString(),
		SeqNo:             seqNo,
		Timestamp:         now,
		DrugID:            d.ID,
		DrugNameFa:        d.NameFa,
		DosageStrength:    dosageStrength,
		Manufacturer:      d.Manufacturer,
		UnitLabel:         unit,
		BatchID:           batchID,
		BatchNo:           req.BatchNo,
		Expiry:            req.Expiry,
		TxType:            req.TxType,
		TxSubLabel:        txSubLabel,
		WasteMode:         req.WasteMode,
		QtyIn:             qtyIn,
		QtyOut:            qtyOut,
		AmpouleWasteCount: wasteCount,
		BalanceAfter:      balanceAfter,
		VaultBinAddress:   vaultAddress,
		PhysicianName:     req.PhysicianName,
		PhysicianLicense:  req.PhysicianLicense,
		PatientNationalID: req.PatientNationalID,
		PatientNote:       req.PatientNote,
		TrackingCode:      req.TrackingCode,
		SepasCode:         req.SepasCode,
		TechnicalAck:      req.TechnicalAck,
		SignedBy: SignedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		Source: SourceLedger,
	}
	entry.SearchNorm = buildSearchNorm(entry)

	if err := s.repo.Insert(ctx, entry); err != nil {
		s.compensate(ctx, rollbackFn, movementID)
		return EntryDTO{}, err
	}

	if s.audit != nil {
		if _, err := s.audit.Append(ctx, audit.AppendInput{
			Actor: audit.Actor{
				ID:       actor.UserID,
				Name:     actor.Name,
				Role:     actor.Role,
				Initials: actor.Initials,
			},
			Action:                auditAction,
			EntityType:            "narcotic_book",
			EntityID:              entry.ID,
			EntityLabel:           fmt.Sprintf("ردیف %d · %s", entry.SeqNo, entry.DrugNameFa),
			Description:           auditDesc,
			Severity:              severity,
			Source:                "api",
			After:                 map[string]any{"seqNo": entry.SeqNo, "txType": entry.TxType, "batchNo": entry.BatchNo, "qtyIn": entry.QtyIn, "qtyOut": entry.QtyOut, "balanceAfter": entry.BalanceAfter, "trackingCode": entry.TrackingCode},
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: true,
		}); err != nil {
			// Ledger entry is already written; return error if audit fails? Better: log/return err,
			// though in practice audit insert shares the same healthy Mongo connection.
			return EntryDTO{}, err
		}
	}

	return ToDTO(entry), nil
}

// DispenseHookInput captures a confirmed controlled line from dispensing-dispatch.
type DispenseHookInput struct {
	OrderID             string
	OrderNo             string
	DrugID              string
	DrugNameFa          string
	UnitLabel           string
	Quantity            int
	BatchID             string
	BatchNo             string
	Expiry              string
	LocationLabel       string
	PhysicianName       string
	PhysicianLicense    string
	RecipientNationalID string
	ERxTrackingID       string
	TechnicalAck        bool
	Actor               requestctx.Actor
	At                  time.Time
}

// RecordFromDispensing appends an immutable ledger row when a controlled drug is dispensed via /dispensing-dispatch.
func (s *Service) RecordFromDispensing(ctx context.Context, in DispenseHookInput) error {
	if strings.TrimSpace(in.DrugID) == "" || in.Quantity <= 0 {
		return nil
	}
	balanceAfter, err := s.computeDrugVaultBalance(ctx, in.DrugID)
	if err != nil {
		return err
	}
	seqNo, err := s.repo.NextSeq(ctx)
	if err != nil {
		return err
	}
	at := in.At
	if at.IsZero() {
		at = s.now()
	}
	d, _ := s.drugs.Get(ctx, in.DrugID)
	dosageStrength := ""
	manufacturer := ""
	if d != nil {
		dosageStrength = strings.TrimSpace(strings.TrimSpace(d.DosageForm) + " " + strings.TrimSpace(d.Strength))
		manufacturer = d.Manufacturer
	}
	unit := strings.TrimSpace(in.UnitLabel)
	if unit == "" {
		unit = "عدد"
	}
	entry := Entry{
		ID:                uuid.NewString(),
		SeqNo:             seqNo,
		Timestamp:         at,
		DrugID:            in.DrugID,
		DrugNameFa:        in.DrugNameFa,
		DosageStrength:    dosageStrength,
		Manufacturer:      manufacturer,
		UnitLabel:         unit,
		BatchID:           in.BatchID,
		BatchNo:           in.BatchNo,
		Expiry:            in.Expiry,
		TxType:            TxOutPrescription,
		TxSubLabel:        "حواله نسخه الکترونیک",
		QtyOut:            in.Quantity,
		BalanceAfter:      balanceAfter,
		VaultBinAddress:   in.LocationLabel,
		PhysicianName:     in.PhysicianName,
		PhysicianLicense:  in.PhysicianLicense,
		PatientNationalID: in.RecipientNationalID,
		PatientNote:       "ثبت خودکار از حواله " + in.OrderNo,
		TrackingCode:      in.ERxTrackingID,
		SepasCode:         in.OrderNo,
		TechnicalAck:      in.TechnicalAck,
		SignedBy: SignedBy{
			UserID: in.Actor.UserID,
			Name:   in.Actor.Name,
			Role:   in.Actor.Role,
		},
		Source: SourceDispensing,
		RefID:  in.OrderID,
	}
	entry.SearchNorm = buildSearchNorm(entry)
	return s.repo.Insert(ctx, entry)
}

// ReceiptHookInput captures a confirmed controlled batch from invoice-receipts.
type ReceiptHookInput struct {
	ReceiptID     string
	InvoiceNo     string
	Distributor   string
	DrugID        string
	DrugNameFa    string
	UnitLabel     string
	Quantity      int
	BatchID       string
	BatchNo       string
	Expiry        string
	LocationLabel string
	Actor         requestctx.Actor
	At            time.Time
}

// RecordFromReceipt appends an immutable ledger row when a controlled drug is received via /invoice-receipts.
func (s *Service) RecordFromReceipt(ctx context.Context, in ReceiptHookInput) error {
	if strings.TrimSpace(in.DrugID) == "" || in.Quantity <= 0 {
		return nil
	}
	balanceAfter, err := s.computeDrugVaultBalance(ctx, in.DrugID)
	if err != nil {
		return err
	}
	seqNo, err := s.repo.NextSeq(ctx)
	if err != nil {
		return err
	}
	at := in.At
	if at.IsZero() {
		at = s.now()
	}
	d, _ := s.drugs.Get(ctx, in.DrugID)
	dosageStrength := ""
	manufacturer := ""
	if d != nil {
		dosageStrength = strings.TrimSpace(strings.TrimSpace(d.DosageForm) + " " + strings.TrimSpace(d.Strength))
		manufacturer = d.Manufacturer
	}
	unit := strings.TrimSpace(in.UnitLabel)
	if unit == "" {
		unit = "عدد"
	}
	entry := Entry{
		ID:               uuid.NewString(),
		SeqNo:            seqNo,
		Timestamp:        at,
		DrugID:           in.DrugID,
		DrugNameFa:       in.DrugNameFa,
		DosageStrength:   dosageStrength,
		Manufacturer:     manufacturer,
		UnitLabel:        unit,
		BatchID:          in.BatchID,
		BatchNo:          in.BatchNo,
		Expiry:           in.Expiry,
		TxType:           TxInDistributor,
		TxSubLabel:       "ورود فاکتور رسمی",
		QtyIn:            in.Quantity,
		BalanceAfter:     balanceAfter,
		VaultBinAddress:  in.LocationLabel,
		PhysicianName:    in.Distributor,
		PhysicianLicense: "حواله " + in.InvoiceNo,
		PatientNote:      "ثبت خودکار از رسید انبار",
		TrackingCode:     in.InvoiceNo,
		TechnicalAck:     true,
		SignedBy: SignedBy{
			UserID: in.Actor.UserID,
			Name:   in.Actor.Name,
			Role:   in.Actor.Role,
		},
		Source: SourceReceipt,
		RefID:  in.ReceiptID,
	}
	entry.SearchNorm = buildSearchNorm(entry)
	return s.repo.Insert(ctx, entry)
}

func (s *Service) Export(ctx context.Context, q ListQuery, format string) ([]byte, string, error) {
	q.Page = 1
	q.PageSize = 5000
	items, _, err := s.repo.List(ctx, ListFilter{
		DrugID:   strings.TrimSpace(q.DrugID),
		TxType:   strings.TrimSpace(q.TxType),
		Search:   strings.TrimSpace(q.Search),
		From:     q.From,
		To:       q.To,
		SortBy:   q.SortBy,
		SortDir:  q.SortDir,
		Page:     1,
		PageSize: 5000,
	})
	if err != nil {
		return nil, "", err
	}
	dtos := make([]EntryDTO, 0, len(items))
	for _, item := range items {
		dtos = append(dtos, ToDTO(item))
	}
	if format == "json" {
		b, err := json.MarshalIndent(dtos, "", "  ")
		return b, "application/json; charset=utf-8", err
	}
	var buf bytes.Buffer
	// UTF-8 BOM for Persian Excel compatibility.
	buf.WriteString("\xEF\xBB\xBF")
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{
		"ردیف", "زمان ثبت (ISO)", "نام فرآورده", "سری ساخت", "نوع گردش",
		"ورود (+)", "خروج (-)", "پوکه امحاشده", "مانده گاوصندوق",
		"پزشک / پخش", "کدملی بیمار (پوشیده)", "شناسه TTAC / سپاس", "تایید مسئول فنی",
	})
	for _, row := range dtos {
		_ = w.Write([]string{
			fmt.Sprintf("%d", row.SeqNo),
			row.Timestamp,
			row.DrugNameFa,
			row.BatchNo,
			row.TxSubLabel,
			fmt.Sprintf("%d", row.QtyIn),
			fmt.Sprintf("%d", row.QtyOut),
			fmt.Sprintf("%d", row.AmpouleWasteCount),
			fmt.Sprintf("%d", row.BalanceAfter),
			row.PhysicianName,
			row.PatientNationalIDMasked,
			row.TrackingCode,
			row.SignedBy.Name,
		})
	}
	w.Flush()
	return buf.Bytes(), "text/csv; charset=utf-8", w.Error()
}

func (s *Service) ExportFilename(format string) string {
	ts := s.now().Format("20060102-150405")
	if format == "json" {
		return fmt.Sprintf("controlled-ledger-%s.json", ts)
	}
	return fmt.Sprintf("controlled-ledger-%s.csv", ts)
}

func (s *Service) loadVaultSnapshot(ctx context.Context) ([]VaultDrugStock, []VaultBinOption, int, error) {
	controlledFlag := true
	drugs, _, err := s.drugs.List(ctx, drug.ListFilter{
		IsControlled: &controlledFlag,
		SortBy:       "nameFa",
		SortDir:      "asc",
		Page:         1,
		PageSize:     200,
	})
	if err != nil {
		return nil, nil, 0, err
	}
	allBatches, err := s.stock.AllBatches(ctx)
	if err != nil {
		return nil, nil, 0, err
	}
	bins, err := s.stock.ListBins(ctx)
	if err != nil {
		return nil, nil, 0, err
	}

	vaultBins := make([]VaultBinOption, 0)
	for _, bin := range bins {
		if bin.Zone == "S" || bin.IsControlled || bin.MacroLocation == "controlled" {
			vaultBins = append(vaultBins, VaultBinOption{
				ID:        bin.ID,
				Address:   bin.Address,
				Zone:      bin.Zone,
				ZoneLabel: bin.ZoneLabel,
			})
		}
	}

	batchesByDrug := map[string][]shelf.StockBatch{}
	for _, b := range allBatches {
		if b.Status == "active" && b.Quantity > 0 {
			batchesByDrug[b.DrugID] = append(batchesByDrug[b.DrugID], b)
		}
	}

	totalVaultBalance := 0
	items := make([]VaultDrugStock, 0, len(drugs))
	for _, d := range drugs {
		drugBatches := batchesByDrug[d.ID]
		sort.Slice(drugBatches, func(i, j int) bool {
			return drugBatches[i].Expiry < drugBatches[j].Expiry
		})
		qty := 0
		addrSeen := map[string]bool{}
		addrs := make([]string, 0)
		opts := make([]VaultBatchOption, 0, len(drugBatches))
		for _, b := range drugBatches {
			qty += b.Quantity
			if b.LocationLabel != "" && !addrSeen[b.LocationLabel] {
				addrSeen[b.LocationLabel] = true
				addrs = append(addrs, b.LocationLabel)
			}
			opts = append(opts, VaultBatchOption{
				BatchID:       b.ID,
				BatchNo:       b.BatchNo,
				Expiry:        b.Expiry,
				Quantity:      b.Quantity,
				BinID:         b.BinID,
				LocationLabel: b.LocationLabel,
			})
		}
		totalVaultBalance += qty
		unit := strings.TrimSpace(d.UnitLabel)
		if unit == "" {
			unit = "عدد"
		}
		items = append(items, VaultDrugStock{
			DrugID:         d.ID,
			NameFa:         d.NameFa,
			DosageForm:     d.DosageForm,
			Strength:       d.Strength,
			Manufacturer:   d.Manufacturer,
			UnitLabel:      unit,
			AvailableStock: qty,
			ReorderLevel:   d.ReorderLevel,
			IsLowStock:     qty <= d.ReorderLevel,
			VaultAddresses: addrs,
			ActiveBatches:  opts,
		})
	}
	return items, vaultBins, totalVaultBalance, nil
}

func (s *Service) resolveVaultBin(ctx context.Context, binID string) (*shelf.Bin, error) {
	if binID != "" {
		bin, err := s.stock.GetBin(ctx, binID)
		if err != nil {
			return nil, err
		}
		if bin == nil {
			return nil, errormap.Validation(validationMessage, map[string]string{
				"binId": "موقعیت گاوصندوق یافت نشد",
			})
		}
		if bin.Zone != "S" && !bin.IsControlled && bin.MacroLocation != "controlled" {
			return nil, errormap.Validation(validationMessage, map[string]string{
				"binId": "داروی تحت کنترل فقط باید در گاوصندوق حفاظت‌شده (زون S) نگهداری شود",
			})
		}
		return bin, nil
	}
	bins, err := s.stock.ListBins(ctx)
	if err != nil {
		return nil, err
	}
	for i := range bins {
		if bins[i].Zone == "S" || bins[i].IsControlled || bins[i].MacroLocation == "controlled" {
			return &bins[i], nil
		}
	}
	return nil, errormap.Validation(validationMessage, map[string]string{
		"binId": "هیچ قفسه گاوصندوق حفاظت‌شده تعریف نشده است",
	})
}

func (s *Service) applyInflowStock(ctx context.Context, d *drug.Drug, bin *shelf.Bin, req CreateRequest, unit string) (string, func(), error) {
	existing, err := s.stock.BatchesByDrug(ctx, d.ID)
	if err != nil {
		return "", nil, err
	}
	for _, b := range existing {
		if strings.EqualFold(strings.TrimSpace(b.BatchNo), req.BatchNo) && b.BinID == bin.ID && b.Status == "active" {
			prevQty := b.Quantity
			if err := s.stock.UpdateBatchQuantity(ctx, b.ID, prevQty+req.Quantity); err != nil {
				return "", nil, err
			}
			undo := func() {
				_ = s.stock.UpdateBatchQuantity(ctx, b.ID, prevQty)
			}
			return b.ID, undo, nil
		}
	}

	newBatch := shelf.StockBatch{
		ID:            uuid.NewString(),
		DrugID:        d.ID,
		BinID:         bin.ID,
		NameFa:        d.NameFa,
		BatchNo:       req.BatchNo,
		Expiry:        req.Expiry,
		Quantity:      req.Quantity,
		Status:        "active",
		UnitLabel:     unit,
		Manufacturer:  d.Manufacturer,
		Distributor:   req.PhysicianName,
		InvoiceNo:     req.TrackingCode,
		Category:      d.Category,
		IsControlled:  true,
		Zone:          bin.Zone,
		LocationLabel: bin.Address,
	}
	if err := s.stock.InsertBatch(ctx, newBatch); err != nil {
		return "", nil, err
	}
	undo := func() {
		_ = s.stock.DeleteBatch(ctx, newBatch.ID)
	}
	return newBatch.ID, undo, nil
}

func (s *Service) applyOutflowStock(ctx context.Context, drugID, batchID, batchNo string, quantity int) (shelf.StockBatch, func(), error) {
	var target *shelf.StockBatch
	if batchID != "" {
		b, err := s.stock.GetBatch(ctx, batchID)
		if err != nil {
			return shelf.StockBatch{}, nil, err
		}
		if b == nil || b.DrugID != drugID {
			return shelf.StockBatch{}, nil, errormap.Validation(validationMessage, map[string]string{
				"batchId": "سری ساخت انتخاب‌شده برای این دارو یافت نشد",
			})
		}
		target = b
	} else {
		batches, err := s.stock.BatchesByDrug(ctx, drugID)
		if err != nil {
			return shelf.StockBatch{}, nil, err
		}
		for i := range batches {
			if batches[i].Status == "active" && strings.EqualFold(strings.TrimSpace(batches[i].BatchNo), batchNo) {
				target = &batches[i]
				break
			}
		}
		if target == nil {
			return shelf.StockBatch{}, nil, errormap.Validation(validationMessage, map[string]string{
				"batchNo": "سری ساخت با این شماره در گاوصندوق یافت نشد",
			})
		}
	}

	if target.Status != "active" || target.Quantity <= 0 {
		return shelf.StockBatch{}, nil, errormap.Validation(validationMessage, map[string]string{
			"batchNo": "این سری ساخت فعال نیست یا موجودی آن صفر است",
		})
	}
	if target.Quantity < quantity {
		return shelf.StockBatch{}, nil, errormap.Validation(validationMessage, map[string]string{
			"quantity": fmt.Sprintf("موجودی سری ساخت (%d) از تعداد درخواستی کمتر است", target.Quantity),
		})
	}

	prevQty := target.Quantity
	prevStatus := target.Status
	nextQty := prevQty - quantity
	if err := s.stock.UpdateBatchQuantity(ctx, target.ID, nextQty); err != nil {
		return shelf.StockBatch{}, nil, err
	}
	undo := func() {
		_ = s.stock.UpdateBatchQuantity(ctx, target.ID, prevQty)
		if nextQty <= 0 {
			_ = s.stock.UpdateBatchStatus(ctx, target.ID, prevStatus)
		}
	}
	return *target, undo, nil
}

func (s *Service) computeDrugVaultBalance(ctx context.Context, drugID string) (int, error) {
	batches, err := s.stock.BatchesByDrug(ctx, drugID)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, b := range batches {
		if b.Status == "active" && b.Quantity > 0 {
			total += b.Quantity
		}
	}
	return total, nil
}

func (s *Service) defaultVaultAddress(ctx context.Context, drugID string) string {
	batches, err := s.stock.BatchesByDrug(ctx, drugID)
	if err == nil {
		for _, b := range batches {
			if b.LocationLabel != "" {
				return b.LocationLabel
			}
		}
	}
	return "S-01-1-01"
}

func (s *Service) compensate(ctx context.Context, rollbackFn func(), movementID string) {
	if rollbackFn != nil {
		rollbackFn()
	}
	if movementID != "" && s.cardex != nil {
		_ = s.cardex.Delete(ctx, movementID)
	}
}

func normalizeRequest(req CreateRequest) CreateRequest {
	req.DrugID = strings.TrimSpace(req.DrugID)
	req.TxType = strings.TrimSpace(req.TxType)
	req.WasteMode = strings.TrimSpace(req.WasteMode)
	req.BatchID = strings.TrimSpace(req.BatchID)
	req.BatchNo = strings.TrimSpace(req.BatchNo)
	req.Expiry = strings.TrimSpace(req.Expiry)
	req.BinID = strings.TrimSpace(req.BinID)
	req.PhysicianName = strings.TrimSpace(req.PhysicianName)
	req.PhysicianLicense = strings.TrimSpace(req.PhysicianLicense)
	req.PatientNationalID = validator.NormalizeFa(req.PatientNationalID)
	req.PatientNote = strings.TrimSpace(req.PatientNote)
	req.TrackingCode = strings.TrimSpace(req.TrackingCode)
	req.SepasCode = strings.TrimSpace(req.SepasCode)
	return req
}

func validateCreateRequest(req CreateRequest) map[string]string {
	fields := map[string]string{}
	if req.DrugID == "" {
		fields["drugId"] = "انتخاب فرآورده تحت کنترل الزامی است"
	}
	switch req.TxType {
	case TxInDistributor, TxOutPrescription, TxWasteReturn:
	default:
		fields["txType"] = "نوع گردش نامعتبر است"
	}
	if req.Quantity <= 0 || req.Quantity > maxRegisterQty {
		fields["quantity"] = "تعداد باید بین ۱ تا ۱۰۰۰۰ واحد باشد"
	}
	if req.BatchNo == "" && req.BatchID == "" {
		fields["batchNo"] = "شماره سری ساخت الزامی است"
	}
	if req.TrackingCode == "" {
		fields["trackingCode"] = "شناسه یکتای TTAC / سپاس الزامی است"
	}
	if !req.TechnicalAck {
		fields["technicalAck"] = "تأیید و امضای دیجیتال مسئول فنی الزامی است"
	}

	switch req.TxType {
	case TxOutPrescription:
		if req.PhysicianName == "" {
			fields["physicianName"] = "نام پزشک معالج الزامی است"
		}
		if !isTenDigits(req.PatientNationalID) {
			fields["patientNationalId"] = "کدملی بیمار باید دقیقاً ۱۰ رقم باشد"
		}
	case TxInDistributor:
		if req.PhysicianName == "" {
			fields["physicianName"] = "نام شرکت پخش یا حواله‌دهنده الزامی است"
		}
		if req.Expiry == "" {
			fields["expiry"] = "تاریخ انقضای سری ساخت الزامی است"
		}
	case TxWasteReturn:
		if req.WasteMode != "" && req.WasteMode != WasteModeUsedAmpoule && req.WasteMode != WasteModeDamagedStock {
			fields["wasteMode"] = "نوع عملیات پوکه/امحا نامعتبر است"
		}
	}
	return fields
}

func isTenDigits(s string) bool {
	if len(s) != 10 {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func buildSearchNorm(e Entry) string {
	parts := []string{
		e.DrugNameFa,
		e.BatchNo,
		e.PhysicianName,
		e.PhysicianLicense,
		e.PatientNationalID,
		e.TrackingCode,
		e.SepasCode,
		e.PatientNote,
		e.VaultBinAddress,
	}
	return validator.NormalizeFa(strings.Join(parts, " "))
}
