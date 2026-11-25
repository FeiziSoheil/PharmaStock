package inventory

import (
	"bytes"
	"context"
	"encoding/csv"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

type drugStore interface {
	All(ctx context.Context) ([]drug.Drug, error)
	Get(ctx context.Context, id string) (*drug.Drug, error)
	FindByGTIN(ctx context.Context, gtin string, excludeID string) (*drug.Drug, error)
	Insert(ctx context.Context, d drug.Drug) error
	Delete(ctx context.Context, id string) error
	UpdateStockSummary(ctx context.Context, id string, totalStock int, nearestExpiry string) error
}

type shelfStore interface {
	ActiveBatches(ctx context.Context) ([]shelf.StockBatch, error)
	ListBins(ctx context.Context) ([]shelf.Bin, error)
	BatchesByDrug(ctx context.Context, drugID string) ([]shelf.StockBatch, error)
	GetBatchesByIDs(ctx context.Context, ids []string) ([]shelf.StockBatch, error)
	UpdateBatchesStatus(ctx context.Context, ids []string, status string) (int64, error)
}

type batchCreator interface {
	CreateBatchCore(ctx context.Context, req expiry.CreateRequest, actorName string) (shelf.StockBatch, string, error)
}

type cardexWriter interface {
	Append(ctx context.Context, in cardex.AppendInput) (cardex.Movement, error)
}

type auditStore interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
	LatestTimestamp(ctx context.Context) (*time.Time, error)
}

var (
	_ drugStore    = (*drug.Repository)(nil)
	_ shelfStore   = (*shelf.Repository)(nil)
	_ batchCreator = (*expiry.Service)(nil)
	_ cardexWriter = (*cardex.Service)(nil)
	_ auditStore   = (*audit.Service)(nil)
)

var allowedBatchStatuses = map[string]bool{
	"active":        true,
	"quarantined":   true,
	"marked_return": true,
	"quick_sale":    true,
	"relocated":     true,
}

type Service struct {
	drugs  drugStore
	shelf  shelfStore
	expiry batchCreator
	cardex cardexWriter
	audit  auditStore
	now    func() time.Time
}

func NewService(drugs drugStore, shelf shelfStore, exp batchCreator, cardex cardexWriter, audit auditStore) *Service {
	return &Service{
		drugs:  drugs,
		shelf:  shelf,
		expiry: exp,
		cardex: cardex,
		audit:  audit,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) Dashboard(ctx context.Context, q DashboardQuery) (DashboardResponse, error) {
	allDrugs, batches, bins, lastAudit, err := s.fetchSnapshotInputs(ctx)
	if err != nil {
		return DashboardResponse{}, err
	}

	today := s.now()
	todayISO := today.Format("2006-01-02")

	drugByID := make(map[string]drug.Drug, len(allDrugs))
	for _, d := range allDrugs {
		drugByID[d.ID] = d
	}

	binByID := make(map[string]shelf.Bin, len(bins))
	for _, b := range bins {
		binByID[b.ID] = b
	}

	usableByDrug := make(map[string]int, len(allDrugs))
	stockDrugSet := make(map[string]struct{}, len(allDrugs))
	for _, b := range batches {
		if b.Status == "quarantined" || b.Status == "marked_return" {
			continue
		}
		stockDrugSet[b.DrugID] = struct{}{}
		bucket, ok := domain.GetExpiryBucket(b.Expiry, today)
		if !ok || bucket == domain.BucketExpired {
			continue
		}
		usableByDrug[b.DrugID] += b.Quantity
	}

	kpis := computeKPIs(allDrugs, batches, drugByID, usableByDrug, stockDrugSet, lastAudit, today)
	rows := buildRows(batches, drugByID, binByID, usableByDrug, today, q)
	sortRows(rows, q.SortBy, q.SortDir)

	p := normalizePagination(q.Page, q.PageSize)
	total := len(rows)
	start := (p.Page - 1) * p.PageSize
	if start > total {
		start = total
	}
	end := start + p.PageSize
	if end > total {
		end = total
	}
	wrapped := pagination.Wrap(rows[start:end], total, p.Page, p.PageSize)

	return DashboardResponse{
		TodayISO:  todayISO,
		KPIs:      kpis,
		Items:     wrapped.Items,
		Total:     wrapped.Total,
		Page:      wrapped.Page,
		PageSize:  wrapped.PageSize,
		PageCount: wrapped.PageCount,
	}, nil
}

func (s *Service) fetchSnapshotInputs(ctx context.Context) ([]drug.Drug, []shelf.StockBatch, []shelf.Bin, *time.Time, error) {
	var (
		allDrugs  []drug.Drug
		batches   []shelf.StockBatch
		bins      []shelf.Bin
		lastAudit *time.Time
		errDrugs  error
		errBatch  error
		errBins   error
		errAudit  error
		wg        sync.WaitGroup
	)

	wg.Add(4)
	go func() {
		defer wg.Done()
		allDrugs, errDrugs = s.drugs.All(ctx)
	}()
	go func() {
		defer wg.Done()
		batches, errBatch = s.shelf.ActiveBatches(ctx)
	}()
	go func() {
		defer wg.Done()
		bins, errBins = s.shelf.ListBins(ctx)
	}()
	go func() {
		defer wg.Done()
		lastAudit, errAudit = s.audit.LatestTimestamp(ctx)
	}()
	wg.Wait()

	for _, e := range []error{errDrugs, errBatch, errBins, errAudit} {
		if e != nil {
			return nil, nil, nil, nil, e
		}
	}
	return allDrugs, batches, bins, lastAudit, nil
}

func computeKPIs(
	allDrugs []drug.Drug,
	batches []shelf.StockBatch,
	drugByID map[string]drug.Drug,
	usableByDrug map[string]int,
	stockDrugSet map[string]struct{},
	lastAudit *time.Time,
	today time.Time,
) KPIs {
	categories := make(map[string]struct{})
	belowRop := 0
	criticalShortage := 0
	leadSum := 0
	leadCount := 0
	coveredCount := 0

	for _, d := range allDrugs {
		if d.Category != "" {
			categories[d.Category] = struct{}{}
		}
		usable := usableByDrug[d.ID]
		input := domain.ReorderItemInput{
			AvailableStock: usable,
			ReorderPoint:   d.ReorderLevel,
			TargetStock:    d.TargetStock,
			AvgDailyUsage:  d.AvgDailyUsage,
			PackSize:       d.PackSize,
		}
		if domain.NeedsReorder(input) {
			belowRop++
			days := domain.DaysOfCover(input)
			urg := domain.UrgencyFromDaysOfCover(days)
			if usable == 0 || urg == domain.UrgencyCritical {
				criticalShortage++
			}
			if d.LeadTimeDays > 0 {
				leadSum += d.LeadTimeDays
				leadCount++
			}
		} else {
			coveredCount++
		}
	}

	var nearExpiry, criticalExpiry, totalUnits, activeBatchCount int
	var nearExpiryVal, totalVal int64

	for _, b := range batches {
		unitPrice := batchUnitPrice(b, drugByID[b.DrugID])
		rowVal := int64(b.Quantity) * int64(unitPrice)
		bucket, ok := domain.GetExpiryBucket(b.Expiry, today)

		if b.Status != "quarantined" && b.Status != "marked_return" {
			activeBatchCount++
			totalUnits += b.Quantity
			totalVal += rowVal
		}

		if !ok {
			continue
		}
		if b.Status == "quarantined" || b.Status == "marked_return" {
			if bucket == domain.BucketExpired {
				criticalExpiry++
			}
			continue
		}
		switch bucket {
		case domain.BucketExpired:
			criticalExpiry++
		case domain.BucketCritical:
			criticalExpiry++
			nearExpiry++
			nearExpiryVal += rowVal
		case domain.BucketWarning:
			nearExpiry++
			nearExpiryVal += rowVal
		}
	}

	coveragePct := 100.0
	if len(allDrugs) > 0 {
		coveragePct = math.Round((float64(coveredCount)/float64(len(allDrugs)))*1000) / 10
	}
	avgLead := 0.0
	if leadCount > 0 {
		avgLead = math.Round((float64(leadSum)/float64(leadCount))*10) / 10
	}

	totalSkus := len(stockDrugSet)
	if totalSkus == 0 {
		totalSkus = len(allDrugs)
	}

	lastAuditISO := ""
	if lastAudit != nil {
		lastAuditISO = lastAudit.UTC().Format(time.RFC3339)
	}

	return KPIs{
		TotalSkus:             totalSkus,
		CatalogTotalSkus:      len(allDrugs),
		ActiveCategories:      len(categories),
		DemandCoveragePct:     coveragePct,
		BelowRopCount:         belowRop,
		CriticalShortageCount: criticalShortage,
		AvgLeadTimeDays:       avgLead,
		NearExpiryCount:       nearExpiry,
		CriticalExpiryCount:   criticalExpiry,
		NearExpiryValueRial:   nearExpiryVal,
		TotalValuationRial:    totalVal,
		TotalUnits:            totalUnits,
		ActiveBatchCount:      activeBatchCount,
		LastAuditISO:          lastAuditISO,
	}
}

func batchUnitPrice(b shelf.StockBatch, d drug.Drug) int {
	if b.BuyPriceRial > 0 {
		return b.BuyPriceRial
	}
	if b.ConsumerPriceRial > 0 {
		return b.ConsumerPriceRial
	}
	if d.UnitCost > 0 {
		return d.UnitCost
	}
	return 0
}

func buildRows(
	batches []shelf.StockBatch,
	drugByID map[string]drug.Drug,
	binByID map[string]shelf.Bin,
	usableByDrug map[string]int,
	today time.Time,
	q DashboardQuery,
) []InventoryRow {
	searchNorm := validator.NormalizeFa(q.Search)
	rows := make([]InventoryRow, 0, len(batches))

	for _, b := range batches {
		d := drugByID[b.DrugID]
		bin := binByID[b.BinID]

		nameFa := b.NameFa
		if d.NameFa != "" {
			nameFa = d.NameFa
		}
		category := b.Category
		if d.Category != "" {
			category = d.Category
		}
		storageTemp := d.StorageTemp
		if storageTemp == "" {
			storageTemp = "room"
		}
		unitLabel := b.UnitLabel
		if unitLabel == "" {
			unitLabel = d.UnitLabel
		}
		if unitLabel == "" {
			unitLabel = "عدد"
		}
		locationLabel := b.LocationLabel
		if locationLabel == "" && bin.Address != "" {
			locationLabel = bin.Address
		}
		zone := b.Zone
		if zone == "" {
			zone = bin.Zone
		}

		bucket, ok := domain.GetExpiryBucket(b.Expiry, today)
		if !ok {
			bucket = domain.BucketOK
		}
		days, _ := domain.DaysUntilExpiry(b.Expiry, today)
		usable := usableByDrug[b.DrugID]
		invStatus := deriveInventoryStatus(b.Status, bucket, usable, d.ReorderLevel)

		if q.Category != "" && category != q.Category {
			continue
		}
		if q.StorageTemp != "" && storageTemp != q.StorageTemp {
			continue
		}
		if q.StockStatus != "" && invStatus != q.StockStatus {
			continue
		}
		if searchNorm != "" && !matchesSearch(searchNorm, nameFa, d.BrandName, d.GenericCode, d.GTIN, b.BatchNo, locationLabel) {
			continue
		}

		unitPrice := batchUnitPrice(b, d)
		rows = append(rows, InventoryRow{
			BatchID:           b.ID,
			DrugID:            b.DrugID,
			NameFa:            nameFa,
			BrandName:         d.BrandName,
			DosageForm:        d.DosageForm,
			Strength:          d.Strength,
			GenericCode:       d.GenericCode,
			GTIN:              d.GTIN,
			Category:          category,
			IsControlled:      b.IsControlled || d.IsControlled,
			StorageTemp:       storageTemp,
			BatchNo:           b.BatchNo,
			Expiry:            b.Expiry,
			DaysUntilExpiry:   days,
			ExpiryBucket:      string(bucket),
			Quantity:          b.Quantity,
			DrugUsableStock:   usable,
			ReorderLevel:      d.ReorderLevel,
			UnitLabel:         unitLabel,
			BinID:             b.BinID,
			LocationLabel:     locationLabel,
			Zone:              zone,
			BatchStatus:       b.Status,
			InventoryStatus:   invStatus,
			BuyPriceRial:      b.BuyPriceRial,
			ConsumerPriceRial: b.ConsumerPriceRial,
			RowValueRial:      int64(b.Quantity) * int64(unitPrice),
		})
	}
	return rows
}

func deriveInventoryStatus(batchStatus string, bucket domain.ExpiryBucket, usableStock, reorderLevel int) string {
	if batchStatus == "quarantined" || batchStatus == "marked_return" || bucket == domain.BucketExpired {
		return "expired_quarantine"
	}
	if bucket == domain.BucketCritical || bucket == domain.BucketWarning {
		return "expiring"
	}
	if usableStock <= reorderLevel {
		return "low"
	}
	return "valid"
}

func matchesSearch(needleNorm string, fields ...string) bool {
	for _, f := range fields {
		if f == "" {
			continue
		}
		if strings.Contains(validator.NormalizeFa(f), needleNorm) {
			return true
		}
	}
	return false
}

func sortRows(rows []InventoryRow, sortBy, sortDir string) {
	desc := sortDir == "desc"
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := rows[i], rows[j]
		switch sortBy {
		case "nameFa":
			if a.NameFa == b.NameFa {
				return a.Expiry < b.Expiry
			}
			if desc {
				return a.NameFa > b.NameFa
			}
			return a.NameFa < b.NameFa
		case "quantity":
			if a.Quantity == b.Quantity {
				return a.Expiry < b.Expiry
			}
			if desc {
				return a.Quantity > b.Quantity
			}
			return a.Quantity < b.Quantity
		default: // expiry (FEFO default)
			if a.Expiry == b.Expiry {
				return a.NameFa < b.NameFa
			}
			if desc {
				return a.Expiry > b.Expiry
			}
			return a.Expiry < b.Expiry
		}
	})
}

func normalizePagination(page, pageSize int) pagination.Params {
	if page < 1 {
		page = 1
	}
	switch pageSize {
	case 10, 25, 50, 100:
	default:
		pageSize = 25
	}
	return pagination.Params{Page: page, PageSize: pageSize}
}

func (s *Service) ExportCSV(ctx context.Context, q DashboardQuery) ([]byte, error) {
	allDrugs, batches, bins, _, err := s.fetchSnapshotInputs(ctx)
	if err != nil {
		return nil, err
	}
	today := s.now()
	drugByID := make(map[string]drug.Drug, len(allDrugs))
	for _, d := range allDrugs {
		drugByID[d.ID] = d
	}
	binByID := make(map[string]shelf.Bin, len(bins))
	for _, b := range bins {
		binByID[b.ID] = b
	}
	usableByDrug := make(map[string]int, len(allDrugs))
	for _, b := range batches {
		if b.Status == "quarantined" || b.Status == "marked_return" {
			continue
		}
		if bucket, ok := domain.GetExpiryBucket(b.Expiry, today); ok && bucket != domain.BucketExpired {
			usableByDrug[b.DrugID] += b.Quantity
		}
	}

	rows := buildRows(batches, drugByID, binByID, usableByDrug, today, q)
	sortRows(rows, q.SortBy, q.SortDir)

	var buf bytes.Buffer
	// UTF-8 BOM so Microsoft Excel renders Persian text cleanly.
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{
		"شناسه بچ",
		"نام دارو",
		"برند",
		"دسته درمانی",
		"کد IRC / ژنریک",
		"GTIN",
		"شماره سری ساخت",
		"موقعیت قفسه",
		"تاریخ انقضا",
		"موجودی",
		"آستانه سفارش",
		"واحد",
		"وضعیت",
		"ارزش ریالی",
	})
	for _, r := range rows {
		_ = w.Write([]string{
			r.BatchID,
			r.NameFa,
			r.BrandName,
			r.Category,
			r.GenericCode,
			r.GTIN,
			r.BatchNo,
			r.LocationLabel,
			r.Expiry,
			strconv.Itoa(r.Quantity),
			strconv.Itoa(r.ReorderLevel),
			r.UnitLabel,
			statusLabelFa(r.InventoryStatus),
			strconv.FormatInt(r.RowValueRial, 10),
		})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

func statusLabelFa(invStatus string) string {
	switch invStatus {
	case "valid":
		return "موجود و معتبر"
	case "low":
		return "روبه‌اتمام (کسری)"
	case "expiring":
		return "نزدیک انقضا (FEFO)"
	case "expired_quarantine":
		return "منقضی / قرنطینه"
	default:
		return invStatus
	}
}

func (s *Service) StockIn(ctx context.Context, req StockInRequest, actor requestctx.Actor, ip string) (StockInResponse, error) {
	if err := validateStockIn(req); err != nil {
		return StockInResponse{}, err
	}

	var targetDrug drug.Drug
	createdNew := false

	if strings.TrimSpace(req.DrugID) != "" {
		existing, err := s.drugs.Get(ctx, strings.TrimSpace(req.DrugID))
		if err != nil {
			return StockInResponse{}, err
		}
		if existing == nil {
			return StockInResponse{}, errormap.NotFound("داروی انتخاب‌شده یافت نشد")
		}
		targetDrug = *existing
	} else {
		if gtin := strings.TrimSpace(req.GTIN); gtin != "" {
			dup, err := s.drugs.FindByGTIN(ctx, gtin, "")
			if err != nil {
				return StockInResponse{}, err
			}
			if dup != nil {
				return StockInResponse{}, errormap.Conflict("کد GTIN تکراری است؛ این دارو قبلاً در کاتالوگ ثبت شده است")
			}
		}
		storageTemp := strings.TrimSpace(req.StorageTemp)
		if storageTemp == "" {
			storageTemp = "room"
		}
		unitLabel := strings.TrimSpace(req.UnitLabel)
		if unitLabel == "" {
			unitLabel = "عدد"
		}
		targetDrug = drug.Drug{
			ID:           uuid.NewString(),
			NameFa:       strings.TrimSpace(req.NameFa),
			BrandName:    strings.TrimSpace(req.BrandName),
			DosageForm:   strings.TrimSpace(req.DosageForm),
			Strength:     strings.TrimSpace(req.Strength),
			GTIN:         strings.TrimSpace(req.GTIN),
			GenericCode:  strings.TrimSpace(req.GenericCode),
			Manufacturer: strings.TrimSpace(req.Manufacturer),
			Category:     strings.TrimSpace(req.Category),
			IsControlled: req.IsControlled,
			ATCCode:      strings.TrimSpace(req.ATCCode),
			StorageTemp:  storageTemp,
			ReorderLevel: req.ReorderLevel,
			PackSize:     1,
			UnitCost:     req.BuyPriceRial,
			UnitLabel:    unitLabel,
			NameNorm:     validator.NormalizeFa(req.NameFa),
		}
		if err := s.drugs.Insert(ctx, targetDrug); err != nil {
			return StockInResponse{}, err
		}
		createdNew = true
	}

	batchReq := expiry.CreateRequest{
		DrugID:            targetDrug.ID,
		BatchNo:           strings.TrimSpace(req.BatchNo),
		Expiry:            strings.TrimSpace(req.Expiry),
		Quantity:          req.Quantity,
		UnitLabel:         strings.TrimSpace(req.UnitLabel),
		LocationLabel:     strings.TrimSpace(req.LocationLabel),
		BinID:             strings.TrimSpace(req.BinID),
		Manufacturer:      targetDrug.Manufacturer,
		Distributor:       strings.TrimSpace(req.Distributor),
		InvoiceNo:         strings.TrimSpace(req.InvoiceNo),
		BuyPriceRial:      req.BuyPriceRial,
		ConsumerPriceRial: req.ConsumerPriceRial,
		StorageNote:       strings.TrimSpace(req.StorageNote),
		NameEn:            targetDrug.BrandName,
	}

	batch, _, err := s.expiry.CreateBatchCore(ctx, batchReq, actor.Name)
	if err != nil {
		if createdNew {
			_ = s.drugs.Delete(ctx, targetDrug.ID)
		}
		return StockInResponse{}, err
	}

	s.syncDrugSummary(ctx, &targetDrug)

	if createdNew {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:                 audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:                "item_created",
			EntityType:            "drug",
			EntityID:              targetDrug.ID,
			EntityLabel:           targetDrug.NameFa,
			Description:           "ثبت داروی جدید از داشبورد انبار",
			After:                 map[string]any{"nameFa": targetDrug.NameFa, "gtin": targetDrug.GTIN},
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: targetDrug.IsControlled,
		})
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:                 audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action:                "stock_in",
		EntityType:            "batch",
		EntityID:              batch.ID,
		EntityLabel:           targetDrug.NameFa + " / " + batch.BatchNo,
		Description:           "ورود سری ساخت جدید به انبار",
		After:                 map[string]any{"batchNo": batch.BatchNo, "quantity": batch.Quantity, "locationLabel": batch.LocationLabel},
		IP:                    ip,
		BranchID:              actor.BranchID,
		IsControlledSubstance: targetDrug.IsControlled,
	})

	return StockInResponse{
		Drug:           targetDrug,
		Batch:          batch,
		CreatedNewDrug: createdNew,
	}, nil
}

func validateStockIn(req StockInRequest) error {
	fields := map[string]string{}
	if strings.TrimSpace(req.DrugID) == "" {
		if strings.TrimSpace(req.NameFa) == "" {
			fields["nameFa"] = "نام رسمی فارسی دارو الزامی است"
		}
		if strings.TrimSpace(req.DosageForm) == "" {
			fields["dosageForm"] = "شکل دارویی الزامی است"
		}
		if strings.TrimSpace(req.Strength) == "" {
			fields["strength"] = "دوز و قدرت اثر الزامی است"
		}
		if strings.TrimSpace(req.Category) == "" {
			fields["category"] = "دسته درمانی الزامی است"
		}
	}
	if strings.TrimSpace(req.BatchNo) == "" {
		fields["batchNo"] = "شماره سری ساخت (Batch) الزامی است"
	}
	exp := strings.TrimSpace(req.Expiry)
	if exp == "" {
		fields["expiry"] = "تاریخ انقضا الزامی است"
	} else if _, ok := domain.ParseExpiryDate(exp); !ok {
		fields["expiry"] = "فرمت تاریخ انقضا نامعتبر است"
	}
	if req.Quantity <= 0 {
		fields["quantity"] = "تعداد ورودی باید بزرگ‌تر از صفر باشد"
	}
	if req.ReorderLevel < 0 {
		fields["reorderLevel"] = "آستانه سفارش مجدد نمی‌تواند منفی باشد"
	}
	if strings.TrimSpace(req.BinID) == "" && strings.TrimSpace(req.LocationLabel) == "" {
		fields["locationLabel"] = "انتخاب قفسه یا آدرس انبارش الزامی است"
	}
	if len(fields) > 0 {
		return errormap.Validation("لطفاً فیلدهای الزامی فرم را تکمیل کنید", fields)
	}
	return nil
}

func (s *Service) syncDrugSummary(ctx context.Context, d *drug.Drug) {
	batches, err := s.shelf.BatchesByDrug(ctx, d.ID)
	if err != nil {
		return
	}
	totalStock := 0
	nearest := ""
	for _, b := range batches {
		if b.Quantity <= 0 || b.Status == "depleted" || b.Status == "quarantined" || b.Status == "marked_return" {
			continue
		}
		totalStock += b.Quantity
		if b.Expiry != "" && (nearest == "" || b.Expiry < nearest) {
			nearest = b.Expiry
		}
	}
	d.TotalStock = totalStock
	if nearest != "" {
		d.NearestExpiry = nearest
	}
	_ = s.drugs.UpdateStockSummary(ctx, d.ID, d.TotalStock, d.NearestExpiry)
}

func (s *Service) BulkUpdateStatus(ctx context.Context, req BulkStatusRequest, actor requestctx.Actor, ip string) (BulkStatusResponse, error) {
	if len(req.BatchIDs) == 0 {
		return BulkStatusResponse{}, errormap.Validation("حداقل یک سری ساخت را انتخاب کنید", map[string]string{"batchIds": "الزامی است"})
	}
	if !allowedBatchStatuses[req.Status] {
		return BulkStatusResponse{}, errormap.Validation("وضعیت انتخاب‌شده معتبر نیست", map[string]string{"status": "وضعیت مجاز نیست"})
	}

	uniqueIDs := make([]string, 0, len(req.BatchIDs))
	seen := make(map[string]struct{}, len(req.BatchIDs))
	for _, raw := range req.BatchIDs {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniqueIDs = append(uniqueIDs, id)
	}
	if len(uniqueIDs) == 0 {
		return BulkStatusResponse{}, errormap.Validation("حداقل یک سری ساخت معتبر انتخاب کنید", map[string]string{"batchIds": "الزامی است"})
	}

	batches, err := s.shelf.GetBatchesByIDs(ctx, uniqueIDs)
	if err != nil {
		return BulkStatusResponse{}, err
	}
	if len(batches) == 0 {
		return BulkStatusResponse{}, errormap.NotFound("سری ساختی با شناسه‌های ارسالی یافت نشد")
	}

	modified, err := s.shelf.UpdateBatchesStatus(ctx, uniqueIDs, req.Status)
	if err != nil {
		return BulkStatusResponse{}, err
	}

	action := "expiry_action_confirmed"
	switch req.Status {
	case "quarantined":
		action = "quarantine"
	case "marked_return":
		action = "return_to_distributor"
	}

	hasControlled := false
	for _, b := range batches {
		if b.IsControlled {
			hasControlled = true
		}
		if req.Status == "quarantined" {
			_, _ = s.cardex.Append(ctx, cardex.AppendInput{
				DrugID: b.DrugID, Type: "quarantine", BatchNo: b.BatchNo, QtyIn: 0, QtyOut: 0,
				ActorName: actor.Name, ShiftLabel: "صبح", Note: "قرنطینه گروهی سری " + b.BatchNo,
			})
		}
	}

	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:                 audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action:                action,
		EntityType:            "batch",
		EntityID:              strings.Join(uniqueIDs, ","),
		EntityLabel:           "عملیات گروهی موجودی (" + strconv.Itoa(len(batches)) + " سری ساخت)",
		Description:           "تغییر وضعیت گروهی سری‌های ساخت",
		After:                 map[string]any{"status": req.Status, "count": len(batches)},
		IP:                    ip,
		BranchID:              actor.BranchID,
		IsControlledSubstance: hasControlled,
	})

	updatedCount := int(modified)
	if updatedCount == 0 {
		updatedCount = len(batches)
	}
	return BulkStatusResponse{UpdatedCount: updatedCount, Status: req.Status}, nil
}
