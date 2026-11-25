package drug

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/ttac"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

type Service struct {
	repo        *Repository
	audit       *audit.Service
	ttac        ttac.Gateway
	ttacEnabled bool
	ttacTTL     time.Duration
}

func NewService(repo *Repository, auditSvc *audit.Service, gw ttac.Gateway, enabled bool, cacheTTL time.Duration) *Service {
	return &Service{repo: repo, audit: auditSvc, ttac: gw, ttacEnabled: enabled, ttacTTL: cacheTTL}
}

func (s *Service) List(ctx context.Context, search, dosage, category string, controlled *bool, p pagination.Params) (pagination.Result[Drug], error) {
	items, total, err := s.repo.List(ctx, ListFilter{
		Search: validator.NormalizeFa(search), DosageForm: dosage, Category: category,
		IsControlled: controlled, SortBy: p.SortBy, SortDir: p.SortDir, Page: p.Page, PageSize: p.PageSize,
	})
	if err != nil {
		return pagination.Result[Drug]{}, err
	}
	return pagination.Wrap(items, int(total), p.Page, p.PageSize), nil
}

func (s *Service) Get(ctx context.Context, id string) (Drug, error) {
	d, err := s.repo.Get(ctx, id)
	if err != nil {
		return Drug{}, err
	}
	if d == nil {
		return Drug{}, errormap.NotFound("دارو یافت نشد")
	}
	return *d, nil
}

func (s *Service) Create(ctx context.Context, req UpsertRequest, actor requestctx.Actor, ip string) (Drug, error) {
	if err := validateUpsert(req); err != nil {
		return Drug{}, err
	}
	if req.GTIN != "" {
		existing, err := s.repo.FindByGTIN(ctx, req.GTIN, "")
		if err != nil {
			return Drug{}, err
		}
		if existing != nil {
			return Drug{}, errormap.Conflict("کد GTIN تکراری است")
		}
	}
	d := fromUpsert(uuid.NewString(), req)
	if err := s.repo.Insert(ctx, d); err != nil {
		return Drug{}, err
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:  audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action: "item_created", EntityType: "drug", EntityID: d.ID, EntityLabel: d.NameFa,
		Description: "ثبت داروی جدید", After: map[string]any{"nameFa": d.NameFa}, IP: ip, BranchID: actor.BranchID,
		IsControlledSubstance: d.IsControlled,
	})
	return d, nil
}

func (s *Service) Update(ctx context.Context, id string, req UpsertRequest, actor requestctx.Actor, ip string) (Drug, error) {
	if err := validateUpsert(req); err != nil {
		return Drug{}, err
	}
	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return Drug{}, err
	}
	if cur == nil {
		return Drug{}, errormap.NotFound("دارو یافت نشد")
	}
	if req.GTIN != "" {
		existing, err := s.repo.FindByGTIN(ctx, req.GTIN, id)
		if err != nil {
			return Drug{}, err
		}
		if existing != nil {
			return Drug{}, errormap.Conflict("کد GTIN تکراری است")
		}
	}
	d := fromUpsert(id, req)
	d.TotalStock = cur.TotalStock
	d.NearestExpiry = cur.NearestExpiry
	if d.TargetStock == 0 {
		d.TargetStock = cur.TargetStock
	}
	if d.PackSize == 0 {
		d.PackSize = cur.PackSize
	}
	d.AvgDailyUsage = cur.AvgDailyUsage
	d.UnitCost = cur.UnitCost
	d.DistributorID = cur.DistributorID
	d.LeadTimeDays = cur.LeadTimeDays
	d.UnitLabel = cur.UnitLabel
	if err := s.repo.Replace(ctx, d); err != nil {
		return Drug{}, err
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor:  audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action: "item_edited", EntityType: "drug", EntityID: d.ID, EntityLabel: d.NameFa,
		Description: "ویرایش مشخصات دارو",
		Before:      map[string]any{"nameFa": cur.NameFa}, After: map[string]any{"nameFa": d.NameFa},
		IP: ip, BranchID: actor.BranchID, IsControlledSubstance: d.IsControlled,
	})
	return d, nil
}

func (s *Service) LookupTTAC(ctx context.Context, q string) map[string]any {
	res := ttac.Lookup(ctx, q, s.ttac, repoCacheAdapter{s.repo}, s.ttacEnabled, s.ttacTTL, time.Now().UTC())
	switch res.Status {
	case ttac.StatusFound:
		return map[string]any{"status": "found", "product": productFromMapped(res.Product, res.FromCache)}
	case ttac.StatusError:
		return map[string]any{"status": "error", "message": res.Message}
	default:
		return map[string]any{"status": "not_found"}
	}
}

func (s *Service) SearchTTAC(ctx context.Context, term string, page, pageSize int, includeInactive bool) ([]ttac.SearchHit, int, error) {
	return ttac.Search(ctx, term, page, pageSize, includeInactive, s.ttac, s.ttacEnabled)
}

type repoCacheAdapter struct{ repo *Repository }

func (a repoCacheAdapter) Get(ctx context.Context, irc, gtin string) (*ttac.Cached, error) {
	if a.repo == nil {
		return nil, nil
	}
	row, err := a.repo.GetTTACCache(ctx, irc, gtin)
	if err != nil || row == nil {
		return nil, err
	}
	product := mappedFromProduct(row.Product)
	product.RawStatus = row.RawStatus
	return &ttac.Cached{
		IRC: row.IRC, GTIN: row.GTIN, GenericCode: row.GenericCode,
		Product: product, FetchedAt: row.FetchedAt, RawStatus: row.RawStatus,
	}, nil
}

func (a repoCacheAdapter) Put(ctx context.Context, row ttac.Cached) error {
	if a.repo == nil {
		return nil
	}
	return a.repo.UpsertTTACCache(ctx, TtacCache{
		IRC: row.IRC, GTIN: row.GTIN, GenericCode: row.GenericCode,
		Product: productFromMapped(row.Product, false), FetchedAt: row.FetchedAt, RawStatus: row.RawStatus,
	})
}

func productFromMapped(p ttac.MappedProduct, fromCache bool) TtacProduct {
	return TtacProduct{
		NameFa: p.NameFa, BrandName: p.BrandName, DosageForm: p.DosageForm, Strength: p.Strength,
		GTIN: p.GTIN, IRC: p.IRC, GenericCode: p.GenericCode, Manufacturer: p.Manufacturer,
		ATCCode: p.ATCCode, LicenseExpiry: p.LicenseExpiry, Category: p.Category,
		StatusStr: p.StatusStr, PackageConsumerPrice: p.PackageConsumerPrice, FromCache: fromCache,
	}
}

func mappedFromProduct(p TtacProduct) ttac.MappedProduct {
	return ttac.MappedProduct{
		NameFa: p.NameFa, BrandName: p.BrandName, DosageForm: p.DosageForm, Strength: p.Strength,
		GTIN: p.GTIN, IRC: p.IRC, GenericCode: p.GenericCode, Manufacturer: p.Manufacturer,
		ATCCode: p.ATCCode, LicenseExpiry: p.LicenseExpiry, Category: p.Category,
		StatusStr: p.StatusStr, PackageConsumerPrice: p.PackageConsumerPrice,
	}
}

func validateUpsert(req UpsertRequest) error {
	fields := map[string]string{}
	if strings.TrimSpace(req.NameFa) == "" {
		fields["nameFa"] = "نام فارسی الزامی است"
	}
	if strings.TrimSpace(req.DosageForm) == "" {
		fields["dosageForm"] = "شکل دارویی الزامی است"
	}
	if strings.TrimSpace(req.Strength) == "" {
		fields["strength"] = "قدرت الزامی است"
	}
	if strings.TrimSpace(req.Category) == "" {
		fields["category"] = "رده الزامی است"
	}
	if len(fields) > 0 {
		return errormap.Validation("لطفاً فیلدهای الزامی را تکمیل کنید", fields)
	}
	return nil
}

func fromUpsert(id string, req UpsertRequest) Drug {
	pack := req.PackSize
	if pack <= 0 {
		pack = 1
	}
	return Drug{
		ID: id, NameFa: strings.TrimSpace(req.NameFa), BrandName: strings.TrimSpace(req.BrandName),
		DosageForm: req.DosageForm, Strength: req.Strength, GTIN: req.GTIN, GenericCode: req.GenericCode,
		Manufacturer: req.Manufacturer, Category: req.Category, IsControlled: req.IsControlled,
		ReorderLevel: req.ReorderLevel, ATCCode: req.ATCCode, StorageTemp: req.StorageTemp,
		NameNorm: validator.NormalizeFa(req.NameFa), TargetStock: req.TargetStock, PackSize: pack,
	}
}

func ParseControlledQuery(v string) *bool {
	if v == "" {
		return nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return nil
	}
	return &b
}
