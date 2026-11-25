package expiry

import (
	"context"
	"strings"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

type Service struct {
	shelf  *shelf.Repository
	drugs  *drug.Repository
	cardex *cardex.Service
	audit  *audit.Service
	now    func() time.Time
}

func NewService(shelfRepo *shelf.Repository, drugRepo *drug.Repository, cardexSvc *cardex.Service, auditSvc *audit.Service) *Service {
	return &Service{
		shelf: shelfRepo, drugs: drugRepo, cardex: cardexSvc, audit: auditSvc,
		now: func() time.Time { return time.Now().UTC() },
	}
}

type Row struct {
	shelf.StockBatch
	Bucket string `json:"bucket"`
	Days   int    `json:"daysUntilExpiry"`
}

type KPIs struct {
	Expired  int `json:"expired"`
	Critical int `json:"critical"`
	Warning  int `json:"warning"`
	Watch    int `json:"watch"`
}

type ListResponse struct {
	pagination.Result[Row]
	KPIs           KPIs                   `json:"kpis"`
	FefoViolations []domain.FefoViolation `json:"fefoViolations"`
}

func (s *Service) List(ctx context.Context, search, bucket, category, zone, status string, controlled *bool, p pagination.Params) (ListResponse, error) {
	batches, err := s.shelf.AllBatches(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	today := s.now()
	var rows []Row
	var kpis KPIs
	var fefoItems []domain.FefoListItem

	for _, b := range batches {
		bk, ok := domain.GetExpiryBucket(b.Expiry, today)
		if !ok {
			continue
		}
		days, _ := domain.DaysUntilExpiry(b.Expiry, today)
		switch bk {
		case domain.BucketExpired:
			kpis.Expired++
		case domain.BucketCritical:
			kpis.Critical++
		case domain.BucketWarning:
			kpis.Warning++
		case domain.BucketWatch:
			kpis.Watch++
		}
		if bucket != "" && string(bk) != bucket {
			continue
		}
		if category != "" && b.Category != category {
			continue
		}
		if zone != "" && b.Zone != zone {
			continue
		}
		if status != "" && b.Status != status {
			continue
		}
		if controlled != nil && b.IsControlled != *controlled {
			continue
		}
		if search != "" {
			n := validator.NormalizeFa(search)
			if !strings.Contains(validator.NormalizeFa(b.NameFa), n) &&
				!strings.Contains(strings.ToLower(b.BatchNo), n) {
				continue
			}
		}
		rows = append(rows, Row{StockBatch: b, Bucket: string(bk), Days: days})
		fefoItems = append(fefoItems, domain.FefoListItem{DrugID: b.DrugID, BatchID: b.ID, ExpiryISO: b.Expiry})
	}

	if p.SortBy == "" || p.SortBy == "expiry" {
		sortRowsByExpiry(rows, p.SortDir != "desc")
	}

	total := len(rows)
	start := (p.Page - 1) * p.PageSize
	if start > total {
		start = total
	}
	end := start + p.PageSize
	if end > total {
		end = total
	}
	pageItems := rows[start:end]
	return ListResponse{
		Result:         pagination.Wrap(pageItems, total, p.Page, p.PageSize),
		KPIs:           kpis,
		FefoViolations: domain.FindFefoViolations(fefoItems),
	}, nil
}

func sortRowsByExpiry(rows []Row, asc bool) {
	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			less := rows[i].Expiry < rows[j].Expiry
			if (!asc && less) || (asc && !less && rows[i].Expiry != rows[j].Expiry) {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}
}

type StatusRequest struct {
	Status string `json:"status"`
}

type CreateRequest struct {
	DrugID            string `json:"drugId"`
	BatchNo           string `json:"batchNo"`
	Expiry            string `json:"expiry"`
	Quantity          int    `json:"quantity"`
	UnitLabel         string `json:"unitLabel"`
	LocationLabel     string `json:"locationLabel"`
	BinID             string `json:"binId"`
	Manufacturer      string `json:"manufacturer"`
	Distributor       string `json:"distributor"`
	InvoiceNo         string `json:"invoiceNo"`
	ProductionISO     string `json:"productionISO"`
	BuyPriceRial      int    `json:"buyPriceRial"`
	ConsumerPriceRial int    `json:"consumerPriceRial"`
	StorageNote       string `json:"storageNote"`
	NameEn            string `json:"nameEn"`
	Status            string `json:"status"`
}

type LocationRequest struct {
	LocationLabel string `json:"locationLabel"`
	BinID         string `json:"binId"`
	Zone          string `json:"zone"`
}

var allowedStatus = map[string]bool{
	"active": true, "quarantined": true, "marked_return": true, "quick_sale": true, "relocated": true,
}

func (s *Service) Create(ctx context.Context, req CreateRequest, actor requestctx.Actor, ip string) (shelf.StockBatch, error) {
	b, _, err := s.CreateBatchCore(ctx, req, actor.Name)
	if err != nil {
		return shelf.StockBatch{}, err
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:  audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action: "stock_in", EntityType: "batch", EntityID: b.ID, EntityLabel: b.NameFa + " / " + b.BatchNo,
		Description: "ثبت سری ساخت جدید", After: map[string]any{"batchNo": b.BatchNo, "quantity": b.Quantity},
		IP: ip, BranchID: actor.BranchID, IsControlledSubstance: b.IsControlled,
	})
	return b, nil
}

func (s *Service) UpdateLocation(ctx context.Context, batchID string, req LocationRequest, actor requestctx.Actor, ip string) (shelf.StockBatch, error) {
	if strings.TrimSpace(req.LocationLabel) == "" {
		return shelf.StockBatch{}, errormap.Validation("محل قفسه الزامی است", map[string]string{"locationLabel": "محل قفسه الزامی است"})
	}
	cur, err := s.shelf.GetBatch(ctx, batchID)
	if err != nil {
		return shelf.StockBatch{}, err
	}
	if cur == nil {
		return shelf.StockBatch{}, errormap.NotFound("سری‌ساخت یافت نشد")
	}

	oldLocation := cur.LocationLabel
	binID := strings.TrimSpace(req.BinID)
	zone := strings.TrimSpace(req.Zone)
	location := strings.TrimSpace(req.LocationLabel)
	if binID != "" {
		bin, err := s.shelf.GetBin(ctx, binID)
		if err != nil {
			return shelf.StockBatch{}, err
		}
		if bin != nil {
			zone = bin.Zone
			if location == "" {
				location = bin.Address
			}
		}
	}
	if err := s.shelf.UpdateBatchLocation(ctx, batchID, location, binID, zone); err != nil {
		return shelf.StockBatch{}, err
	}
	cur.LocationLabel = location
	if binID != "" {
		cur.BinID = binID
	}
	if zone != "" {
		cur.Zone = zone
	}

	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:  audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action: "shelf_move", EntityType: "batch", EntityID: batchID, EntityLabel: cur.NameFa + " / " + cur.BatchNo,
		Description: "جابجایی قفسه", Before: map[string]any{"locationLabel": oldLocation},
		After: map[string]any{"locationLabel": location}, IP: ip, BranchID: actor.BranchID,
		IsControlledSubstance: cur.IsControlled,
	})
	_, _ = s.cardex.Append(ctx, cardex.AppendInput{
		DrugID: cur.DrugID, Type: "transfer", BatchNo: cur.BatchNo, QtyIn: 0, QtyOut: 0,
		ActorName: actor.Name, ShiftLabel: "صبح", Note: "جابجایی به " + location,
	})
	return *cur, nil
}

func (s *Service) UpdateStatus(ctx context.Context, batchID string, req StatusRequest, actor requestctx.Actor, ip string) (shelf.StockBatch, error) {
	if !allowedStatus[req.Status] {
		return shelf.StockBatch{}, errormap.Validation("وضعیت نامعتبر است", map[string]string{"status": "وضعیت مجاز نیست"})
	}
	cur, err := s.shelf.GetBatch(ctx, batchID)
	if err != nil {
		return shelf.StockBatch{}, err
	}
	if cur == nil {
		return shelf.StockBatch{}, errormap.NotFound("سری‌ساخت یافت نشد")
	}
	if err := s.shelf.UpdateBatchStatus(ctx, batchID, req.Status); err != nil {
		return shelf.StockBatch{}, err
	}
	action := "expiry_action_confirmed"
	if req.Status == "quarantined" {
		action = "quarantine"
	}
	if req.Status == "marked_return" {
		action = "return_to_distributor"
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:  audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action: action, EntityType: "batch", EntityID: batchID, EntityLabel: cur.NameFa + " / " + cur.BatchNo,
		Description: "تایید اقدام انقضا", Before: map[string]any{"status": cur.Status}, After: map[string]any{"status": req.Status},
		IP: ip, BranchID: actor.BranchID, IsControlledSubstance: cur.IsControlled,
	})
	if req.Status == "quarantined" {
		_, _ = s.cardex.Append(ctx, cardex.AppendInput{
			DrugID: cur.DrugID, Type: "quarantine", BatchNo: cur.BatchNo, QtyIn: 0, QtyOut: 0,
			ActorName: actor.Name, ShiftLabel: "صبح", Note: "انتقال سری " + cur.BatchNo + " به قرنطینه",
		})
	}
	cur.Status = req.Status
	return *cur, nil
}
