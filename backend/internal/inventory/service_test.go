package inventory

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/requestctx"
)

type fakeDrugStore struct {
	items   map[string]drug.Drug
	deleted []string
}

func (f *fakeDrugStore) All(context.Context) ([]drug.Drug, error) {
	out := make([]drug.Drug, 0, len(f.items))
	for _, d := range f.items {
		out = append(out, d)
	}
	return out, nil
}
func (f *fakeDrugStore) Get(_ context.Context, id string) (*drug.Drug, error) {
	d, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	cp := d
	return &cp, nil
}
func (f *fakeDrugStore) FindByGTIN(_ context.Context, gtin string, excludeID string) (*drug.Drug, error) {
	for _, d := range f.items {
		if d.GTIN == gtin && d.ID != excludeID {
			cp := d
			return &cp, nil
		}
	}
	return nil, nil
}
func (f *fakeDrugStore) Insert(_ context.Context, d drug.Drug) error {
	f.items[d.ID] = d
	return nil
}
func (f *fakeDrugStore) Delete(_ context.Context, id string) error {
	delete(f.items, id)
	f.deleted = append(f.deleted, id)
	return nil
}
func (f *fakeDrugStore) UpdateStockSummary(_ context.Context, id string, totalStock int, nearestExpiry string) error {
	if d, ok := f.items[id]; ok {
		d.TotalStock = totalStock
		if nearestExpiry != "" {
			d.NearestExpiry = nearestExpiry
		}
		f.items[id] = d
	}
	return nil
}

type fakeShelfStore struct {
	batches []shelf.StockBatch
	bins    []shelf.Bin
	updated map[string]string
}

func (f *fakeShelfStore) ActiveBatches(context.Context) ([]shelf.StockBatch, error) {
	return append([]shelf.StockBatch(nil), f.batches...), nil
}
func (f *fakeShelfStore) ListBins(context.Context) ([]shelf.Bin, error) {
	return append([]shelf.Bin(nil), f.bins...), nil
}
func (f *fakeShelfStore) BatchesByDrug(_ context.Context, drugID string) ([]shelf.StockBatch, error) {
	var out []shelf.StockBatch
	for _, b := range f.batches {
		if b.DrugID == drugID {
			out = append(out, b)
		}
	}
	return out, nil
}
func (f *fakeShelfStore) GetBatchesByIDs(_ context.Context, ids []string) ([]shelf.StockBatch, error) {
	set := map[string]bool{}
	for _, id := range ids {
		set[id] = true
	}
	var out []shelf.StockBatch
	for _, b := range f.batches {
		if set[b.ID] {
			out = append(out, b)
		}
	}
	return out, nil
}
func (f *fakeShelfStore) UpdateBatchesStatus(_ context.Context, ids []string, status string) (int64, error) {
	if f.updated == nil {
		f.updated = map[string]string{}
	}
	var count int64
	for i := range f.batches {
		for _, id := range ids {
			if f.batches[i].ID == id {
				f.batches[i].Status = status
				f.updated[id] = status
				count++
			}
		}
	}
	return count, nil
}

type fakeBatchCreator struct {
	shelf *fakeShelfStore
	err   error
}

func (f *fakeBatchCreator) CreateBatchCore(_ context.Context, req expiry.CreateRequest, _ string) (shelf.StockBatch, string, error) {
	if f.err != nil {
		return shelf.StockBatch{}, "", f.err
	}
	b := shelf.StockBatch{
		ID:            "batch-new-1",
		DrugID:        req.DrugID,
		BinID:         req.BinID,
		BatchNo:       req.BatchNo,
		Expiry:        req.Expiry,
		Quantity:      req.Quantity,
		Status:        "active",
		UnitLabel:     req.UnitLabel,
		LocationLabel: req.LocationLabel,
		BuyPriceRial:  req.BuyPriceRial,
	}
	f.shelf.batches = append(f.shelf.batches, b)
	return b, "cardex-1", nil
}

type fakeCardex struct{ items []cardex.AppendInput }

func (f *fakeCardex) Append(_ context.Context, in cardex.AppendInput) (cardex.Movement, error) {
	f.items = append(f.items, in)
	return cardex.Movement{ID: "mv-1"}, nil
}

type fakeAudit struct {
	events []audit.AppendInput
	latest *time.Time
}

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	f.events = append(f.events, in)
	return audit.Event{ID: "ev-1"}, nil
}
func (f *fakeAudit) LatestTimestamp(context.Context) (*time.Time, error) {
	return f.latest, nil
}

func fixtureService() (*Service, *fakeDrugStore, *fakeShelfStore, *fakeBatchCreator, *fakeCardex, *fakeAudit) {
	drugs := &fakeDrugStore{
		items: map[string]drug.Drug{
			"d1": {
				ID: "d1", NameFa: "آموکسی‌سیلین", BrandName: "Amoxil", DosageForm: "کپسول", Strength: "500mg",
				GenericCode: "12345", GTIN: "626001", Category: "آنتی‌بیوتیک و ضدباکتری",
				ReorderLevel: 40, TargetStock: 120, AvgDailyUsage: 8, PackSize: 10, UnitCost: 1000,
				LeadTimeDays: 4, UnitLabel: "جعبه", StorageTemp: "room",
			},
			"d2": {
				ID: "d2", NameFa: "انسولین قلمی", BrandName: "Lantus", DosageForm: "قلم تزریقی", Strength: "100IU",
				GenericCode: "77881", GTIN: "626002", Category: "دیابت و غدد",
				ReorderLevel: 20, TargetStock: 60, AvgDailyUsage: 3, PackSize: 5, UnitCost: 5000,
				LeadTimeDays: 6, UnitLabel: "قلم", StorageTemp: "fridge",
			},
		},
	}
	sh := &fakeShelfStore{
		bins: []shelf.Bin{
			{ID: "bin-1", Zone: "A", Address: "A-01-1-01"},
			{ID: "bin-2", Zone: "R", Address: "R-01-1-01"},
		},
		batches: []shelf.StockBatch{
			// Near expiry (critical <= 30 days) + low stock for d2 (usable 10 <= 20)
			{ID: "b1", DrugID: "d2", BinID: "bin-2", NameFa: "انسولین قلمی", BatchNo: "IN-10", Expiry: "2026-11-25", Quantity: 10, Status: "active", LocationLabel: "R-01-1-01", BuyPriceRial: 5000},
			// Healthy stock for d1 (usable 100 > 40)
			{ID: "b2", DrugID: "d1", BinID: "bin-1", NameFa: "آموکسی‌سیلین", BatchNo: "AX-20", Expiry: "2027-09-01", Quantity: 100, Status: "active", LocationLabel: "A-01-1-01", BuyPriceRial: 1000},
			// Expired batch for d1 (excluded from usable stock and total valuation if quarantined, included in criticalExpiryCount)
			{ID: "b3", DrugID: "d1", BinID: "bin-1", NameFa: "آموکسی‌سیلین", BatchNo: "AX-OLD", Expiry: "2026-10-01", Quantity: 5, Status: "active", LocationLabel: "A-01-1-01", BuyPriceRial: 1000},
		},
	}
	bc := &fakeBatchCreator{shelf: sh}
	cx := &fakeCardex{}
	ts := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	au := &fakeAudit{latest: &ts}

	svc := NewService(drugs, sh, bc, cx, au)
	svc.now = func() time.Time { return time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC) }
	return svc, drugs, sh, bc, cx, au
}

func TestDashboardKPIsAndFiltering(t *testing.T) {
	svc, _, _, _, _, _ := fixtureService()
	res, err := svc.Dashboard(context.Background(), DashboardQuery{Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.KPIs.TotalSkus != 2 {
		t.Fatalf("TotalSkus = %d, want 2", res.KPIs.TotalSkus)
	}
	if res.KPIs.BelowRopCount != 1 {
		t.Fatalf("BelowRopCount = %d, want 1", res.KPIs.BelowRopCount)
	}
	if res.KPIs.NearExpiryCount != 1 {
		t.Fatalf("NearExpiryCount = %d, want 1", res.KPIs.NearExpiryCount)
	}
	// b1 (critical) + b3 (expired) = 2
	if res.KPIs.CriticalExpiryCount != 2 {
		t.Fatalf("CriticalExpiryCount = %d, want 2", res.KPIs.CriticalExpiryCount)
	}
	// b1 (10*5000=50000) + b2 (100*1000=100000) + b3 (5*1000=5000) = 155000
	if res.KPIs.TotalValuationRial != 155000 {
		t.Fatalf("TotalValuationRial = %d, want 155000", res.KPIs.TotalValuationRial)
	}
	if len(res.Items) != 3 {
		t.Fatalf("len(Items) = %d, want 3", len(res.Items))
	}
	// Default FEFO sort: b3 (2026-10-01) -> b1 (2026-11-25) -> b2 (2027-09-01)
	if res.Items[0].BatchID != "b3" || res.Items[1].BatchID != "b1" || res.Items[2].BatchID != "b2" {
		t.Fatalf("unexpected FEFO sort order: %+v", []string{res.Items[0].BatchID, res.Items[1].BatchID, res.Items[2].BatchID})
	}

	// Persian/Arabic search normalization ("اموكسي" with Arabic kaf/yeh)
	filtered, err := svc.Dashboard(context.Background(), DashboardQuery{Search: "آموکسي", Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("filtered error: %v", err)
	}
	if filtered.Total != 2 {
		t.Fatalf("filtered Total = %d, want 2", filtered.Total)
	}

	// Filter by storageTemp=fridge
	cold, err := svc.Dashboard(context.Background(), DashboardQuery{StorageTemp: "fridge", Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("cold error: %v", err)
	}
	if cold.Total != 1 || cold.Items[0].BatchID != "b1" {
		t.Fatalf("unexpected cold filter: %+v", cold.Items)
	}
}

func TestStockInValidationAndRollback(t *testing.T) {
	svc, drugs, _, bc, _, au := fixtureService()
	actor := requestctx.Actor{UserID: "u1", Name: "دکتر رضایی", Role: "admin", Initials: "در"}

	// Validation error
	_, err := svc.StockIn(context.Background(), StockInRequest{}, actor, "127.0.0.1")
	var appErr *errormap.AppError
	if !errors.As(err, &appErr) || appErr.Code != "validation_error" {
		t.Fatalf("expected validation error, got %v", err)
	}

	// Rollback created drug if batch creation fails
	bc.err = errors.New("db write failed")
	_, err = svc.StockIn(context.Background(), StockInRequest{
		NameFa: "داروی جدید", DosageForm: "قرص", Strength: "10mg", Category: "قلب و عروق",
		BatchNo: "B-1", Expiry: "2027-12-01", Quantity: 10, BinID: "bin-1",
	}, actor, "127.0.0.1")
	if err == nil {
		t.Fatal("expected error when batch creator fails")
	}
	if len(drugs.deleted) != 1 {
		t.Fatalf("expected rollback delete on drugs, got %v", drugs.deleted)
	}

	// Happy path new drug + batch
	bc.err = nil
	res, err := svc.StockIn(context.Background(), StockInRequest{
		NameFa: "آتورواستاتین", DosageForm: "قرص", Strength: "20mg", Category: "قلب و عروق",
		GTIN: "6269999999", BatchNo: "ATV-1", Expiry: "2027-12-01", Quantity: 50, BinID: "bin-1", BuyPriceRial: 2000,
	}, actor, "127.0.0.1")
	if err != nil {
		t.Fatalf("happy path StockIn failed: %v", err)
	}
	if !res.CreatedNewDrug || res.Drug.TotalStock != 50 {
		t.Fatalf("unexpected StockIn result: %+v", res)
	}
	if len(au.events) < 2 {
		t.Fatalf("expected item_created + stock_in audit events, got %d", len(au.events))
	}
}

func TestBulkUpdateStatusAndExportCSV(t *testing.T) {
	svc, _, sh, _, cx, au := fixtureService()
	actor := requestctx.Actor{UserID: "u1", Name: "دکتر رضایی", Role: "admin", Initials: "در"}

	res, err := svc.BulkUpdateStatus(context.Background(), BulkStatusRequest{
		BatchIDs: []string{"b3", "b1"},
		Status:   "quarantined",
	}, actor, "127.0.0.1")
	if err != nil {
		t.Fatalf("BulkUpdateStatus failed: %v", err)
	}
	if res.UpdatedCount != 2 || sh.updated["b3"] != "quarantined" {
		t.Fatalf("unexpected bulk result: %+v", res)
	}
	if len(cx.items) != 2 || len(au.events) != 1 || au.events[0].Action != "quarantine" {
		t.Fatalf("expected 2 cardex entries + 1 quarantine audit, got cardex=%d audit=%+v", len(cx.items), au.events)
	}

	csvBytes, err := svc.ExportCSV(context.Background(), DashboardQuery{})
	if err != nil {
		t.Fatalf("ExportCSV failed: %v", err)
	}
	csvStr := string(csvBytes)
	if !strings.HasPrefix(csvStr, "\xEF\xBB\xBF") || !strings.Contains(csvStr, "آموکسی‌سیلین") {
		t.Fatalf("unexpected CSV output: %q", csvStr)
	}
}
