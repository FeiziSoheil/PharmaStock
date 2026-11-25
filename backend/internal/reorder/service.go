package reorder

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

var distributors = map[string]string{
	"daroupakhsh": "داروپخش",
	"hejrat":      "پخش هجرت",
	"razi":        "پخش رازی",
	"alborz":      "پخش البرز",
	"ferdows":     "پخش فردوس",
	"abidi":       "داروسازی عبیدی",
}

type DrugStore interface {
	All(ctx context.Context) ([]drug.Drug, error)
}

type ShelfStore interface {
	AllBatches(ctx context.Context) ([]shelf.StockBatch, error)
}

type ReorderStore interface {
	GetSettings(ctx context.Context) (domain.ReorderFormulaConfig, error)
	SaveSettings(ctx context.Context, cfg domain.ReorderFormulaConfig, actorID string) error
	InsertOrders(ctx context.Context, orders []PurchaseOrder) error
	ListOrders(ctx context.Context, status, distributorID string) ([]PurchaseOrder, error)
	GetOrder(ctx context.Context, id string) (*PurchaseOrder, error)
	UpdateOrder(ctx context.Context, po PurchaseOrder) error
	Dismiss(ctx context.Context, drugIDs []string) error
	DismissedDrugIDs(ctx context.Context) (map[string]bool, error)
	OnOrderByDrug(ctx context.Context) (map[string]int, error)
}

type AuditLogger interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

type Service struct {
	drugs DrugStore
	shelf ShelfStore
	repo  ReorderStore
	audit AuditLogger
	now   func() time.Time
}

func NewService(drugs DrugStore, shelfRepo ShelfStore, repo ReorderStore, auditSvc AuditLogger) *Service {
	return &Service{drugs: drugs, shelf: shelfRepo, repo: repo, audit: auditSvc, now: func() time.Time { return time.Now().UTC() }}
}

type ListResponse struct {
	pagination.Result[Suggestion]
	KPIs    KPIs                        `json:"kpis"`
	Formula domain.ReorderFormulaConfig `json:"formula"`
}

func (s *Service) GetSettings(ctx context.Context) (domain.ReorderFormulaConfig, error) {
	return s.repo.GetSettings(ctx)
}

func (s *Service) UpdateSettings(ctx context.Context, cfg domain.ReorderFormulaConfig, actor requestctx.Actor, ip string) (domain.ReorderFormulaConfig, error) {
	if cfg.Mode != domain.FormulaModeDrugDefaults && cfg.Mode != domain.FormulaModeDynamicADU {
		return domain.ReorderFormulaConfig{}, errormap.Validation("روش محاسبه ROP معتبر نیست", map[string]string{"mode": "drug_defaults | dynamic_adu"})
	}
	if cfg.SafetyStockDays < 0 || cfg.SafetyStockDays > 60 {
		return domain.ReorderFormulaConfig{}, errormap.Validation("روز ذخیره ایمن باید بین ۰ تا ۶۰ روز باشد", map[string]string{"safetyStockDays": "0..60"})
	}
	if cfg.TargetCoverageDays < 1 || cfg.TargetCoverageDays > 180 {
		return domain.ReorderFormulaConfig{}, errormap.Validation("افق پوشش هدف باید بین ۱ تا ۱۸۰ روز باشد", map[string]string{"targetCoverageDays": "1..180"})
	}
	if cfg.DefaultBufferPct != 0 && cfg.DefaultBufferPct != 10 && cfg.DefaultBufferPct != 20 {
		return domain.ReorderFormulaConfig{}, errormap.Validation("حاشیه اطمینان پیش‌فرض باید ۰، ۱۰ یا ۲۰ درصد باشد", map[string]string{"defaultBufferPct": "0|10|20"})
	}
	if cfg.CriticalDays < 1 || cfg.CriticalDays > 30 {
		return domain.ReorderFormulaConfig{}, errormap.Validation("آستانه بحرانی باید بین ۱ تا ۳۰ روز باشد", map[string]string{"criticalDays": "1..30"})
	}
	if cfg.LowDays < cfg.CriticalDays || cfg.LowDays > 60 {
		return domain.ReorderFormulaConfig{}, errormap.Validation("آستانه حد ایمن باید بزرگ‌تر یا مساوی آستانه بحرانی باشد", map[string]string{"lowDays": ">= criticalDays"})
	}
	if cfg.ReorderDays < cfg.LowDays || cfg.ReorderDays > 90 {
		return domain.ReorderFormulaConfig{}, errormap.Validation("آستانه نقطه سفارش باید بزرگ‌تر یا مساوی آستانه حد ایمن باشد", map[string]string{"reorderDays": ">= lowDays"})
	}

	if err := s.repo.SaveSettings(ctx, cfg, actor.UserID); err != nil {
		return domain.ReorderFormulaConfig{}, err
	}
	if s.audit != nil {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      "reorder_settings_updated",
			EntityType:  "reorder_settings",
			EntityID:    settingsDocID,
			EntityLabel: "تنظیمات فرمول ROP",
			Description: "به‌روزرسانی پارامترهای فرمول نقطه سفارش (ROP)",
			After: map[string]any{
				"mode":               cfg.Mode,
				"safetyStockDays":    cfg.SafetyStockDays,
				"targetCoverageDays": cfg.TargetCoverageDays,
				"defaultBufferPct":   cfg.DefaultBufferPct,
				"includeOnOrder":     cfg.IncludeOnOrder,
				"roundToPackSize":    cfg.RoundToPackSize,
				"criticalDays":       cfg.CriticalDays,
				"lowDays":            cfg.LowDays,
				"reorderDays":        cfg.ReorderDays,
			},
			IP:          ip,
			BranchID:    actor.BranchID,
		})
	}
	return cfg, nil
}

func (s *Service) List(ctx context.Context, search, distributorID, category, urgency string, controlled *bool, activeOnly bool, p pagination.Params) (ListResponse, error) {
	cfg, err := s.repo.GetSettings(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	drugs, err := s.drugs.All(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	batches, err := s.shelf.AllBatches(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	dismissed, err := s.repo.DismissedDrugIDs(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	onOrder, err := s.repo.OnOrderByDrug(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	today := s.now()
	byDrug := map[string][]domain.ExpiryBatchLike{}
	for _, b := range batches {
		if b.Status == "quarantined" {
			continue
		}
		byDrug[b.DrugID] = append(byDrug[b.DrugID], domain.ExpiryBatchLike{Quantity: b.Quantity, Expiry: b.Expiry})
	}

	var items []Suggestion
	kpis := KPIs{ByDistributor: []DistributorKPI{}}
	distCount := map[string]int{}
	var leadSum float64
	leadN := 0

	for _, d := range drugs {
		avail := domain.SumUsableQuantity(byDrug[d.ID], today)
		oo := onOrder[d.ID]
		pack := d.PackSize
		if pack <= 0 {
			pack = 1
		}
		rop, target := domain.ResolveROPAndTarget(d.ReorderLevel, d.TargetStock, d.LeadTimeDays, d.AvgDailyUsage, cfg)
		input := domain.ReorderItemInput{
			AvailableStock: avail, ReorderPoint: rop, TargetStock: target,
			OnOrderQuantity: oo, AvgDailyUsage: d.AvgDailyUsage, PackSize: pack,
		}
		if !domain.NeedsReorder(input) {
			continue
		}
		status := "active"
		if dismissed[d.ID] {
			status = "dismissed"
		}
		if oo > 0 {
			status = "order_drafted"
		}
		if activeOnly && status != "active" {
			continue
		}
		days := domain.DaysOfCover(input)
		urg := string(domain.UrgencyFromDaysWithThresholds(days, cfg.CriticalDays, cfg.LowDays, cfg.ReorderDays))
		distID := d.DistributorID
		if distID == "" {
			distID = "daroupakhsh"
		}
		distName := distributors[distID]
		if distName == "" {
			distName = distID
		}
		sug := Suggestion{
			ID: "sug-" + d.ID, DrugID: d.ID, NameFa: d.NameFa, DosageForm: d.DosageForm, Strength: d.Strength,
			IRC: d.GenericCode, DistributorID: distID, DistributorNameFa: distName,
			Category: d.Category, IsControlled: d.IsControlled, AvailableStock: avail, ReorderPoint: rop,
			TargetStock: target, OnOrderQuantity: oo, AvgDailyUsage: d.AvgDailyUsage, PackSize: pack,
			UnitCost: d.UnitCost, UnitLabel: d.UnitLabel, LeadTimeDays: d.LeadTimeDays,
			SuggestedQty: domain.SuggestedQuantityWithConfig(input, cfg), DaysOfCover: finiteOrLarge(days), Urgency: urg,
			Status: status, StorageTemp: d.StorageTemp,
		}
		if search != "" {
			n := validator.NormalizeFa(search)
			if !strings.Contains(validator.NormalizeFa(sug.NameFa), n) && !strings.Contains(strings.ToLower(sug.IRC), n) {
				continue
			}
		}
		if distributorID != "" && sug.DistributorID != distributorID {
			continue
		}
		if category != "" && sug.Category != category {
			continue
		}
		if urgency != "" && sug.Urgency != urgency {
			continue
		}
		if controlled != nil && sug.IsControlled != *controlled {
			continue
		}
		items = append(items, sug)
		kpis.BelowROPCount++
		if avail == 0 {
			kpis.ZeroStockCount++
		}
		kpis.EstimatedValue += sug.SuggestedQty * sug.UnitCost
		distCount[distID]++
		if sug.LeadTimeDays > 0 {
			leadSum += float64(sug.LeadTimeDays)
			leadN++
		}
	}

	sortSuggestions(items, p.SortBy, p.SortDir != "desc")
	if leadN > 0 {
		kpis.AvgLeadTimeDays = math.Round((leadSum/float64(leadN))*10) / 10
	}
	for id, cnt := range distCount {
		name := distributors[id]
		if name == "" {
			name = id
		}
		kpis.ByDistributor = append(kpis.ByDistributor, DistributorKPI{ID: id, NameFa: name, Count: cnt})
	}
	sort.Slice(kpis.ByDistributor, func(i, j int) bool {
		return kpis.ByDistributor[i].Count > kpis.ByDistributor[j].Count
	})

	total := len(items)
	start := (p.Page - 1) * p.PageSize
	if start > total {
		start = total
	}
	end := start + p.PageSize
	if end > total {
		end = total
	}
	return ListResponse{
		Result:  pagination.Wrap(items[start:end], total, p.Page, p.PageSize),
		KPIs:    kpis,
		Formula: cfg,
	}, nil
}

func finiteOrLarge(v float64) float64 {
	if math.IsInf(v, 1) {
		return 9999
	}
	return v
}

func sortSuggestions(items []Suggestion, sortBy string, asc bool) {
	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i], items[j]
		var cmp int
		switch sortBy {
		case "nameFa":
			cmp = strings.Compare(a.NameFa, b.NameFa)
		case "availableStock":
			cmp = cmpInt(a.AvailableStock, b.AvailableStock)
		case "suggestedQty":
			cmp = cmpInt(a.SuggestedQty, b.SuggestedQty)
		case "distributorNameFa":
			cmp = strings.Compare(a.DistributorNameFa, b.DistributorNameFa)
		case "unitCost":
			cmp = cmpInt(a.UnitCost, b.UnitCost)
		default: // "daysOfCover"
			if a.DaysOfCover < b.DaysOfCover {
				cmp = -1
			} else if a.DaysOfCover > b.DaysOfCover {
				cmp = 1
			}
		}
		if asc {
			return cmp < 0
		}
		return cmp > 0
	})
}

func cmpInt(a, b int) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

type DraftRequest struct {
	Items []struct {
		ID       string `json:"id"`
		FinalQty int    `json:"finalQty"`
	} `json:"items"`
	BufferPct        int    `json:"bufferPct"`
	Mode             string `json:"mode"` // "draft" (default) | "submit"
	TechnicalConfirm bool   `json:"technicalConfirm"`
	Notes            string `json:"notes"`
}

func (s *Service) Draft(ctx context.Context, req DraftRequest, actor requestctx.Actor, ip string) (map[string]any, error) {
	if len(req.Items) == 0 {
		return nil, errormap.Validation("هیچ قلمی انتخاب نشده است", nil)
	}
	status := "draft"
	if req.Mode == "submit" || req.Mode == "order" {
		status = "submitted"
	} else if req.Mode != "" && req.Mode != "draft" {
		return nil, errormap.Validation("وضعیت درخواستی سفارش نامعتبر است", map[string]string{"mode": "draft | submit"})
	}

	list, err := s.List(ctx, "", "", "", "", nil, false, pagination.Params{Page: 1, PageSize: 500})
	if err != nil {
		return nil, err
	}
	byID := map[string]Suggestion{}
	for _, it := range list.Items {
		byID[it.ID] = it
	}

	now := s.now()
	batchID := uuid.NewString()
	grouped := map[string]*PurchaseOrder{}
	distOrder := []string{}
	perDist := map[string]int{}

	for _, it := range req.Items {
		sug, ok := byID[it.ID]
		if !ok {
			return nil, errormap.NotFound("پیشنهاد یافت نشد: " + it.ID)
		}
		qty := it.FinalQty
		if qty <= 0 {
			return nil, errormap.Validation("تعداد سفارش هر قلم باید بیشتر از صفر باشد", map[string]string{"finalQty": "> 0"})
		}
		if sug.PackSize > 0 && qty%sug.PackSize != 0 {
			return nil, errormap.Validation("تعداد باید مضرب بسته‌بندی باشد", map[string]string{"finalQty": "مضرب " + strconv.Itoa(sug.PackSize)})
		}
		if req.BufferPct > 0 {
			qty = domain.RoundUpToPackSize(qty*(100+req.BufferPct)/100, sug.PackSize)
		}

		po, exists := grouped[sug.DistributorID]
		if !exists {
			poID := uuid.NewString()
			orderNo := fmt.Sprintf("PO-%s-%s", now.Format("060102"), strings.ToUpper(poID[:4]))
			po = &PurchaseOrder{
				ID:                poID,
				OrderNumber:       orderNo,
				BatchID:           batchID,
				DistributorID:     sug.DistributorID,
				DistributorNameFa: sug.DistributorNameFa,
				Status:            status,
				BufferPct:         req.BufferPct,
				TechnicalConfirm:  req.TechnicalConfirm,
				Notes:             strings.TrimSpace(req.Notes),
				ActorID:           actor.UserID,
				ActorName:         actor.Name,
				CreatedAt:         now,
				UpdatedAt:         now,
			}
			grouped[sug.DistributorID] = po
			distOrder = append(distOrder, sug.DistributorID)
		}

		lineTotal := qty * sug.UnitCost
		po.Items = append(po.Items, PurchaseOrderItem{
			SuggestionID: it.ID,
			DrugID:       sug.DrugID,
			NameFa:       sug.NameFa,
			DosageForm:   sug.DosageForm,
			Strength:     sug.Strength,
			IRC:          sug.IRC,
			UnitLabel:    sug.UnitLabel,
			PackSize:     sug.PackSize,
			UnitCost:     sug.UnitCost,
			FinalQty:     qty,
			LineTotal:    lineTotal,
			IsControlled: sug.IsControlled,
		})
		po.ItemCount++
		po.TotalQty += qty
		po.TotalCost += lineTotal
		if sug.IsControlled {
			po.HasControlled = true
		}
		perDist[sug.DistributorNameFa] += qty
	}

	orders := make([]PurchaseOrder, 0, len(distOrder))
	for _, distID := range distOrder {
		orders = append(orders, *grouped[distID])
	}
	if err := s.repo.InsertOrders(ctx, orders); err != nil {
		return nil, err
	}

	action := "reorder_drafted"
	desc := "ثبت پیش‌نویس سفارش خرید کسری"
	if status == "submitted" {
		action = "purchase_order_submitted"
		desc = "تبدیل پیشنهاد کسری به سفارش خرید و ارسال به پخش"
	}
	if s.audit != nil {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      action,
			EntityType:  "purchase_order",
			EntityID:    batchID,
			EntityLabel: "سفارش خرید",
			Description: desc,
			After:       map[string]any{"orderCount": len(orders), "items": len(req.Items), "status": status},
			IP:          ip,
			BranchID:    actor.BranchID,
		})
	}
	return map[string]any{
		"draftId":        batchID,
		"perDistributor": perDist,
		"orders":         orders,
	}, nil
}

type OrdersResponse struct {
	Items []PurchaseOrder `json:"items"`
	Total int             `json:"total"`
}

func (s *Service) ListOrders(ctx context.Context, status, distributorID string) (OrdersResponse, error) {
	orders, err := s.repo.ListOrders(ctx, status, distributorID)
	if err != nil {
		return OrdersResponse{}, err
	}
	return OrdersResponse{Items: orders, Total: len(orders)}, nil
}

type UpdateOrderStatusRequest struct {
	Status           string `json:"status"`
	Notes            string `json:"notes"`
	TechnicalConfirm bool   `json:"technicalConfirm"`
}

func (s *Service) UpdateOrderStatus(ctx context.Context, id string, req UpdateOrderStatusRequest, actor requestctx.Actor, ip string) (PurchaseOrder, error) {
	po, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return PurchaseOrder{}, err
	}
	if po == nil {
		return PurchaseOrder{}, errormap.NotFound("سفارش خرید یافت نشد")
	}

	valid := false
	switch po.Status {
	case "draft":
		valid = req.Status == "submitted" || req.Status == "approved" || req.Status == "cancelled"
	case "submitted":
		valid = req.Status == "approved" || req.Status == "cancelled"
	case "approved":
		valid = req.Status == "cancelled"
	}
	if !valid {
		return PurchaseOrder{}, errormap.Validation("تغییر وضعیت سفارش از "+po.Status+" به "+req.Status+" مجاز نیست", nil)
	}

	if po.HasControlled && req.Status == "approved" && !req.TechnicalConfirm && !po.TechnicalConfirm {
		return PurchaseOrder{}, errormap.Validation("برای تأیید سفارش‌های حاوی قلم تحت کنترل، تأیید صریح مسئول فنی الزامی است", map[string]string{"technicalConfirm": "required"})
	}

	po.Status = req.Status
	if req.TechnicalConfirm {
		po.TechnicalConfirm = true
	}
	if strings.TrimSpace(req.Notes) != "" {
		po.Notes = strings.TrimSpace(req.Notes)
	}
	po.UpdatedAt = s.now()

	if err := s.repo.UpdateOrder(ctx, *po); err != nil {
		return PurchaseOrder{}, err
	}
	if s.audit != nil {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      "purchase_order_status_updated",
			EntityType:  "purchase_order",
			EntityID:    po.ID,
			EntityLabel: po.OrderNumber,
			Description: "تغییر وضعیت سفارش خرید به " + po.Status,
			After:       map[string]any{"status": po.Status, "orderNumber": po.OrderNumber},
			IP:          ip,
			BranchID:    actor.BranchID,
		})
	}
	return *po, nil
}

type ExportRequest struct {
	Items []struct {
		ID       string `json:"id"`
		FinalQty int    `json:"finalQty"`
	} `json:"items"`
	BufferPct     int    `json:"bufferPct"`
	Search        string `json:"search"`
	DistributorID string `json:"distributorId"`
	Category      string `json:"category"`
	Urgency       string `json:"urgency"`
	IsControlled  *bool  `json:"isControlled"`
}

func (s *Service) ExportProforma(ctx context.Context, req ExportRequest) ([]byte, string, error) {
	list, err := s.List(ctx, req.Search, req.DistributorID, req.Category, req.Urgency, req.IsControlled, true, pagination.Params{Page: 1, PageSize: 500, SortBy: "daysOfCover", SortDir: "asc"})
	if err != nil {
		return nil, "", err
	}

	exportItems := list.Items
	overrides := map[string]int{}
	if len(req.Items) > 0 {
		byID := map[string]Suggestion{}
		for _, it := range list.Items {
			byID[it.ID] = it
		}
		selected := make([]Suggestion, 0, len(req.Items))
		for _, sel := range req.Items {
			if sug, ok := byID[sel.ID]; ok {
				selected = append(selected, sug)
				if sel.FinalQty >= 0 {
					overrides[sel.ID] = sel.FinalQty
				}
			}
		}
		exportItems = selected
	} else if req.BufferPct > 0 {
		for _, it := range exportItems {
			overrides[it.ID] = domain.RoundUpToPackSize(it.SuggestedQty*(100+req.BufferPct)/100, it.PackSize)
		}
	}

	if len(exportItems) == 0 {
		return nil, "", errormap.Validation("هیچ قلمی برای خروجی اکسل پیش‌فاکتور یافت نشد", nil)
	}

	data, err := BuildProformaXLSX(exportItems, overrides, req.BufferPct)
	if err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("pharmastock-proforma-%s.xlsx", s.now().Format("20060102-150405"))
	return data, filename, nil
}

func (s *Service) ExportOrder(ctx context.Context, id string) ([]byte, string, error) {
	po, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if po == nil {
		return nil, "", errormap.NotFound("سفارش خرید یافت نشد")
	}
	data, err := BuildPurchaseOrderXLSX(*po)
	if err != nil {
		return nil, "", err
	}
	name := strings.ReplaceAll(po.OrderNumber, " ", "-")
	if name == "" {
		name = po.ID
	}
	return data, fmt.Sprintf("pharmastock-%s.xlsx", name), nil
}

type DismissRequest struct {
	IDs []string `json:"ids"`
}

func (s *Service) Dismiss(ctx context.Context, req DismissRequest) error {
	if len(req.IDs) == 0 {
		return errormap.Validation("شناسه‌ای ارسال نشده است", nil)
	}
	list, err := s.List(ctx, "", "", "", "", nil, false, pagination.Params{Page: 1, PageSize: 500})
	if err != nil {
		return err
	}
	byID := map[string]Suggestion{}
	for _, it := range list.Items {
		byID[it.ID] = it
	}
	var drugIDs []string
	for _, id := range req.IDs {
		if sug, ok := byID[id]; ok {
			drugIDs = append(drugIDs, sug.DrugID)
		}
	}
	return s.repo.Dismiss(ctx, drugIDs)
}
