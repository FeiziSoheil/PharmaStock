package reorder

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"strings"
	"testing"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type fakeDrugStore struct{ items []drug.Drug }

func (f *fakeDrugStore) All(_ context.Context) ([]drug.Drug, error) { return f.items, nil }

type fakeShelfStore struct{ batches []shelf.StockBatch }

func (f *fakeShelfStore) AllBatches(_ context.Context) ([]shelf.StockBatch, error) {
	return f.batches, nil
}

type fakeAudit struct{ events []audit.AppendInput }

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	f.events = append(f.events, in)
	return audit.Event{}, nil
}

type fakeReorderRepo struct {
	settings  *domain.ReorderFormulaConfig
	orders    map[string]PurchaseOrder
	dismissed map[string]bool
}

func newFakeReorderRepo() *fakeReorderRepo {
	return &fakeReorderRepo{
		orders:    map[string]PurchaseOrder{},
		dismissed: map[string]bool{},
	}
}

func (f *fakeReorderRepo) GetSettings(_ context.Context) (domain.ReorderFormulaConfig, error) {
	if f.settings == nil {
		return domain.DefaultReorderFormulaConfig(), nil
	}
	return *f.settings, nil
}

func (f *fakeReorderRepo) SaveSettings(_ context.Context, cfg domain.ReorderFormulaConfig, _ string) error {
	copyCfg := cfg
	f.settings = &copyCfg
	return nil
}

func (f *fakeReorderRepo) InsertOrders(_ context.Context, orders []PurchaseOrder) error {
	for _, o := range orders {
		f.orders[o.ID] = o
	}
	return nil
}

func (f *fakeReorderRepo) ListOrders(_ context.Context, status, distributorID string) ([]PurchaseOrder, error) {
	out := []PurchaseOrder{}
	for _, o := range f.orders {
		if status != "" && o.Status != status {
			continue
		}
		if distributorID != "" && o.DistributorID != distributorID {
			continue
		}
		out = append(out, o)
	}
	return out, nil
}

func (f *fakeReorderRepo) GetOrder(_ context.Context, id string) (*PurchaseOrder, error) {
	o, ok := f.orders[id]
	if !ok {
		return nil, nil
	}
	copyO := o
	return &copyO, nil
}

func (f *fakeReorderRepo) UpdateOrder(_ context.Context, po PurchaseOrder) error {
	f.orders[po.ID] = po
	return nil
}

func (f *fakeReorderRepo) Dismiss(_ context.Context, drugIDs []string) error {
	for _, id := range drugIDs {
		f.dismissed[id] = true
	}
	return nil
}

func (f *fakeReorderRepo) DismissedDrugIDs(_ context.Context) (map[string]bool, error) {
	return f.dismissed, nil
}

func (f *fakeReorderRepo) OnOrderByDrug(_ context.Context) (map[string]int, error) {
	out := map[string]int{}
	for _, o := range f.orders {
		if o.Status == "cancelled" {
			continue
		}
		for _, it := range o.Items {
			out[it.DrugID] += it.FinalQty
		}
	}
	return out, nil
}

func makeTestService() (*Service, *fakeReorderRepo, *fakeAudit) {
	drugs := &fakeDrugStore{
		items: []drug.Drug{
			{
				ID: "d1", NameFa: "آموکسی‌سیلین", DosageForm: "کپسول", Strength: "500mg",
				GenericCode: "12345", Category: "آنتی‌بیوتیک", ReorderLevel: 40, TargetStock: 120,
				PackSize: 10, AvgDailyUsage: 8, UnitCost: 45000, UnitLabel: "عدد",
				DistributorID: "daroupakhsh", LeadTimeDays: 5,
			},
			{
				ID: "d2", NameFa: "مورفین سولفات", DosageForm: "آمپول", Strength: "10mg",
				GenericCode: "99001", Category: "تحت کنترل / مخدر", IsControlled: true,
				ReorderLevel: 15, TargetStock: 35, PackSize: 5, AvgDailyUsage: 1,
				UnitCost: 120000, UnitLabel: "آمپول", DistributorID: "razi", LeadTimeDays: 10,
			},
		},
	}
	batches := &fakeShelfStore{
		batches: []shelf.StockBatch{
			{ID: "b1", DrugID: "d1", Quantity: 20, Expiry: "2028-01-01", Status: "usable"},
			{ID: "b2", DrugID: "d2", Quantity: 10, Expiry: "2028-01-01", Status: "usable"},
		},
	}
	repo := newFakeReorderRepo()
	aud := &fakeAudit{}
	svc := NewService(drugs, batches, repo, aud)
	svc.now = func() time.Time { return time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC) }
	return svc, repo, aud
}

func TestSettingsUpdateRecalculatesSuggestions(t *testing.T) {
	svc, _, aud := makeTestService()
	ctx := context.Background()
	actor := requestctx.Actor{UserID: "u1", Name: "دکتر رضایی", Role: "pharmacist"}

	// Default mode uses drug defaults: d1 ROP=40, Target=120
	res1, err := svc.List(ctx, "", "", "", "", nil, true, pagination.Params{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(res1.Items) != 2 || res1.Items[0].ReorderPoint != 40 {
		t.Fatalf("unexpected default list: %+v", res1.Items)
	}

	// Switch to dynamic_adu: d1 ADU=8, Lead=5, Safety=4 => ROP=72, TargetCoverage=10 => Target=152
	cfg := domain.DefaultReorderFormulaConfig()
	cfg.Mode = domain.FormulaModeDynamicADU
	cfg.SafetyStockDays = 4
	cfg.TargetCoverageDays = 10
	if _, err := svc.UpdateSettings(ctx, cfg, actor, "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	if len(aud.events) != 1 || aud.events[0].Action != "reorder_settings_updated" {
		t.Fatalf("expected audit event for settings update")
	}

	res2, err := svc.List(ctx, "", "", "", "", nil, true, pagination.Params{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatal(err)
	}
	var d1 *Suggestion
	for i := range res2.Items {
		if res2.Items[i].DrugID == "d1" {
			d1 = &res2.Items[i]
		}
	}
	if d1 == nil || d1.ReorderPoint != 72 || d1.TargetStock != 152 {
		t.Fatalf("dynamic_adu calculation mismatch: %+v", d1)
	}

	// Validation check
	bad := cfg
	bad.LowDays = 1
	bad.CriticalDays = 3
	if _, err := svc.UpdateSettings(ctx, bad, actor, "127.0.0.1"); err == nil {
		t.Fatalf("expected validation error for lowDays < criticalDays")
	}
}

func TestDraftSplitByDistributorAndStatusWorkflow(t *testing.T) {
	svc, _, _ := makeTestService()
	ctx := context.Background()
	actor := requestctx.Actor{UserID: "u1", Name: "دکتر رضایی", Role: "pharmacist"}

	var req DraftRequest
	req.Mode = "submit"
	req.Items = []struct {
		ID       string `json:"id"`
		FinalQty int    `json:"finalQty"`
	}{
		{ID: "sug-d1", FinalQty: 100},
		{ID: "sug-d2", FinalQty: 25},
	}

	out, err := svc.Draft(ctx, req, actor, "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	orders, ok := out["orders"].([]PurchaseOrder)
	if !ok || len(orders) != 2 {
		t.Fatalf("expected 2 distributor-split purchase orders, got %+v", out["orders"])
	}

	// Active suggestions should now be empty (both are on order)
	active, err := svc.List(ctx, "", "", "", "", nil, true, pagination.Params{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(active.Items) != 0 {
		t.Fatalf("expected 0 active suggestions after order submission, got %d", len(active.Items))
	}

	// Approving controlled order without technicalConfirm fails
	var controlledOrder PurchaseOrder
	for _, o := range orders {
		if o.HasControlled {
			controlledOrder = o
		}
	}
	if _, err := svc.UpdateOrderStatus(ctx, controlledOrder.ID, UpdateOrderStatusRequest{Status: "approved"}, actor, "127.0.0.1"); err == nil {
		t.Fatalf("expected validation error when approving controlled order without technicalConfirm")
	}

	// Approving with technicalConfirm succeeds
	approved, err := svc.UpdateOrderStatus(ctx, controlledOrder.ID, UpdateOrderStatusRequest{Status: "approved", TechnicalConfirm: true}, actor, "127.0.0.1")
	if err != nil || approved.Status != "approved" {
		t.Fatalf("expected approved order, err=%v po=%+v", err, approved)
	}

	// Cancelling restores item to active suggestions
	if _, err := svc.UpdateOrderStatus(ctx, controlledOrder.ID, UpdateOrderStatusRequest{Status: "cancelled"}, actor, "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	activeAfterCancel, err := svc.List(ctx, "", "", "", "", nil, true, pagination.Params{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatal(err)
	}
	if len(activeAfterCancel.Items) != 1 || activeAfterCancel.Items[0].DrugID != "d2" {
		t.Fatalf("expected d2 restored after cancel, got %+v", activeAfterCancel.Items)
	}
}

func TestExportProformaXLSX(t *testing.T) {
	svc, _, _ := makeTestService()
	ctx := context.Background()

	var req ExportRequest
	req.BufferPct = 10
	req.Items = []struct {
		ID       string `json:"id"`
		FinalQty int    `json:"finalQty"`
	}{
		{ID: "sug-d1", FinalQty: 110},
	}

	data, filename, err := svc.ExportProforma(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(filename, ".xlsx") {
		t.Fatalf("expected .xlsx filename, got %s", filename)
	}

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("invalid xlsx zip: %v", err)
	}
	foundSheet1 := false
	foundSheet2 := false
	for _, f := range zr.File {
		if f.Name == "xl/worksheets/sheet1.xml" {
			foundSheet1 = true
			rc, _ := f.Open()
			raw, _ := io.ReadAll(rc)
			_ = rc.Close()
			if !strings.Contains(string(raw), "آموکسی‌سیلین") || !strings.Contains(string(raw), "110") {
				t.Fatalf("sheet1 missing expected content: %s", string(raw))
			}
		}
		if f.Name == "xl/worksheets/sheet2.xml" {
			foundSheet2 = true
		}
	}
	if !foundSheet1 || !foundSheet2 {
		t.Fatalf("expected 2 sheets in xlsx (sheet1=%v sheet2=%v)", foundSheet1, foundSheet2)
	}
}
