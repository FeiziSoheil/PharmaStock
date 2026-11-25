package shelf

import (
	"context"
	"strings"
	"time"

	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/validator"
)

type Service struct {
	repo *Repository
	now  func() time.Time
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo, now: func() time.Time { return time.Now().UTC() }}
}

type ListResponse struct {
	pagination.Result[BinView]
	KPIs KPIs `json:"kpis"`
}

func (s *Service) List(ctx context.Context, search, zone, macro string, controlledOnly, expiringSoon bool, p pagination.Params) (ListResponse, error) {
	bins, err := s.repo.ListBins(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	today := s.now()
	var views []BinView
	occupied, empty, dispensing, replenish := 0, 0, 0, 0
	var usedCap, totalCap int

	for _, bin := range bins {
		batches, err := s.repo.BatchesByBin(ctx, bin.ID)
		if err != nil {
			return ListResponse{}, err
		}
		qty := 0
		expiring := false
		mapped := make([]Batch, 0, len(batches))
		for _, b := range batches {
			if b.Status == "quarantined" {
				continue
			}
			qty += b.Quantity
			mapped = append(mapped, Batch{DrugID: b.DrugID, NameFa: b.NameFa, BatchNo: b.BatchNo, Expiry: b.Expiry, Quantity: b.Quantity})
			if bucket, ok := domain.GetExpiryBucket(b.Expiry, today); ok && (bucket == domain.BucketCritical || bucket == domain.BucketExpired) {
				expiring = true
			}
		}
		status := binStatus(qty, bin.Capacity, bin.IsControlled, expiring)
		usedCap += qty
		totalCap += bin.Capacity
		if qty > 0 {
			occupied++
		} else {
			empty++
		}
		if bin.MacroLocation == "dispensing" && qty > 0 {
			dispensing++
		}
		if qty*100 < bin.Capacity*20 {
			replenish++
		}

		if zone != "" && bin.Zone != zone {
			continue
		}
		if macro != "" && bin.MacroLocation != macro {
			continue
		}
		if controlledOnly && !bin.IsControlled {
			continue
		}
		if expiringSoon && !expiring {
			continue
		}
		if search != "" {
			n := validator.NormalizeFa(search)
			ok := strings.Contains(validator.NormalizeFa(bin.Address), n)
			if !ok {
				for _, b := range mapped {
					if strings.Contains(validator.NormalizeFa(b.NameFa), n) || strings.Contains(strings.ToLower(b.BatchNo), n) {
						ok = true
						break
					}
				}
			}
			if !ok {
				continue
			}
		}
		views = append(views, BinView{Bin: bin, Batches: mapped, Status: status})
	}

	total := len(views)
	start := (p.Page - 1) * p.PageSize
	if start > total {
		start = total
	}
	end := start + p.PageSize
	if end > total {
		end = total
	}
	pageItems := views[start:end]
	capPct := 0.0
	if totalCap > 0 {
		capPct = float64(usedCap) * 100 / float64(totalCap)
	}
	res := pagination.Wrap(pageItems, total, p.Page, p.PageSize)
	return ListResponse{Result: res, KPIs: KPIs{
		CapacityPct: capPct, OccupiedBins: occupied, TotalBins: len(bins), EmptyBins: empty,
		DispensingReady: dispensing, ReplenishNeeded: replenish, ColdTempC: 4.2,
	}}, nil
}

func (s *Service) Get(ctx context.Context, id string) (BinView, error) {
	bin, err := s.repo.GetBin(ctx, id)
	if err != nil {
		return BinView{}, err
	}
	if bin == nil {
		return BinView{}, errormap.NotFound("قفسه یافت نشد")
	}
	batches, err := s.repo.BatchesByBin(ctx, id)
	if err != nil {
		return BinView{}, err
	}
	mapped := make([]Batch, 0, len(batches))
	qty := 0
	expiring := false
	today := s.now()
	for _, b := range batches {
		mapped = append(mapped, Batch{DrugID: b.DrugID, NameFa: b.NameFa, BatchNo: b.BatchNo, Expiry: b.Expiry, Quantity: b.Quantity})
		qty += b.Quantity
		if bucket, ok := domain.GetExpiryBucket(b.Expiry, today); ok && (bucket == domain.BucketCritical || bucket == domain.BucketExpired) {
			expiring = true
		}
	}
	return BinView{Bin: *bin, Batches: mapped, Status: binStatus(qty, bin.Capacity, bin.IsControlled, expiring)}, nil
}

func binStatus(qty, capacity int, controlled, expiring bool) string {
	if qty <= 0 {
		return "empty"
	}
	if controlled {
		return "controlled"
	}
	if expiring {
		return "expiring"
	}
	if capacity > 0 && qty*100 < capacity*25 {
		return "low"
	}
	return "occupied"
}
