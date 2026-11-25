package stocktake

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type fakeCycleStore struct {
	cycles map[string]Cycle
}

func newFakeCycleStore() *fakeCycleStore {
	return &fakeCycleStore{cycles: make(map[string]Cycle)}
}

func (f *fakeCycleStore) Insert(_ context.Context, c Cycle) error {
	f.cycles[c.ID] = c
	return nil
}

func (f *fakeCycleStore) Get(_ context.Context, id string) (*Cycle, error) {
	c, ok := f.cycles[id]
	if !ok {
		return nil, nil
	}
	cp := c
	cp.Items = append([]CycleItem(nil), c.Items...)
	return &cp, nil
}

func (f *fakeCycleStore) List(_ context.Context, status string, page, pageSize int) ([]Cycle, int64, error) {
	var out []Cycle
	for _, c := range f.cycles {
		if status != "" && c.Status != status {
			continue
		}
		out = append(out, c)
	}
	return out, int64(len(out)), nil
}

func (f *fakeCycleStore) Replace(_ context.Context, c Cycle) error {
	f.cycles[c.ID] = c
	return nil
}

func (f *fakeCycleStore) ReplaceIfActive(_ context.Context, c Cycle) (bool, error) {
	cur, ok := f.cycles[c.ID]
	if !ok || cur.Status != StatusActive {
		return false, nil
	}
	f.cycles[c.ID] = c
	return true, nil
}

func (f *fakeCycleStore) ClaimForConfirm(_ context.Context, id string) (bool, error) {
	cur, ok := f.cycles[id]
	if !ok || cur.Status != StatusActive {
		return false, nil
	}
	cur.Status = StatusConfirming
	f.cycles[id] = cur
	return true, nil
}

func (f *fakeCycleStore) RevertToActive(_ context.Context, id string) error {
	cur, ok := f.cycles[id]
	if !ok {
		return nil
	}
	cur.Status = StatusActive
	cur.AdjustmentDocNo = ""
	cur.ConfirmedAt = nil
	f.cycles[id] = cur
	return nil
}

type fakeShelfStore struct {
	batches map[string]shelf.StockBatch
}

func newFakeShelfStore(initial []shelf.StockBatch) *fakeShelfStore {
	m := make(map[string]shelf.StockBatch, len(initial))
	for _, b := range initial {
		m[b.ID] = b
	}
	return &fakeShelfStore{batches: m}
}

func (f *fakeShelfStore) AllBatches(_ context.Context) ([]shelf.StockBatch, error) {
	out := make([]shelf.StockBatch, 0, len(f.batches))
	for _, b := range f.batches {
		out = append(out, b)
	}
	return out, nil
}

func (f *fakeShelfStore) GetBatch(_ context.Context, id string) (*shelf.StockBatch, error) {
	b, ok := f.batches[id]
	if !ok {
		return nil, nil
	}
	return &b, nil
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

func (f *fakeShelfStore) SetBatchQuantityAndStatus(_ context.Context, id string, quantity int, status string) error {
	b, ok := f.batches[id]
	if !ok {
		return errors.New("not found")
	}
	b.Quantity = quantity
	if status != "" {
		b.Status = status
	}
	f.batches[id] = b
	return nil
}

type fakeDrugStore struct {
	drugs map[string]drug.Drug
}

func newFakeDrugStore(initial []drug.Drug) *fakeDrugStore {
	m := make(map[string]drug.Drug, len(initial))
	for _, d := range initial {
		m[d.ID] = d
	}
	return &fakeDrugStore{drugs: m}
}

func (f *fakeDrugStore) All(_ context.Context) ([]drug.Drug, error) {
	out := make([]drug.Drug, 0, len(f.drugs))
	for _, d := range f.drugs {
		out = append(out, d)
	}
	return out, nil
}

func (f *fakeDrugStore) UpdateTotalStock(_ context.Context, id string, totalStock int) error {
	d, ok := f.drugs[id]
	if !ok {
		return errors.New("drug not found")
	}
	d.TotalStock = totalStock
	f.drugs[id] = d
	return nil
}

type fakeCardex struct {
	movements []cardex.Movement
	failAt    int
}

func (f *fakeCardex) Append(_ context.Context, in cardex.AppendInput) (cardex.Movement, error) {
	if f.failAt > 0 && len(f.movements)+1 >= f.failAt {
		return cardex.Movement{}, errors.New("cardex write failed")
	}
	m := cardex.Movement{
		ID:        "mv-" + string(rune('a'+len(f.movements))),
		DrugID:    in.DrugID,
		Type:      in.Type,
		BatchNo:   in.BatchNo,
		QtyIn:     in.QtyIn,
		QtyOut:    in.QtyOut,
		ActorName: in.ActorName,
		Note:      in.Note,
	}
	f.movements = append(f.movements, m)
	return m, nil
}

func (f *fakeCardex) Delete(_ context.Context, id string) error {
	for i, m := range f.movements {
		if m.ID == id {
			f.movements = append(f.movements[:i], f.movements[i+1:]...)
			break
		}
	}
	return nil
}

type fakeAudit struct {
	events []audit.Event
	fail   bool
}

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	if f.fail {
		return audit.Event{}, errors.New("audit write failed")
	}
	ev := audit.Event{
		ID:                    "aud-1",
		Action:                in.Action,
		EntityType:            in.EntityType,
		EntityID:              in.EntityID,
		EntityLabel:           in.EntityLabel,
		Description:           in.Description,
		Severity:              in.Severity,
		IsControlledSubstance: in.IsControlledSubstance,
		After:                 in.After,
	}
	f.events = append(f.events, ev)
	return ev, nil
}

func fixtureService() (*Service, *fakeCycleStore, *fakeShelfStore, *fakeDrugStore, *fakeCardex, *fakeAudit) {
	cycles := newFakeCycleStore()
	sh := newFakeShelfStore([]shelf.StockBatch{
		{
			ID: "b1", DrugID: "d1", BinID: "bin-a1", NameFa: "آموکسی‌سیلین",
			BatchNo: "AX-1", Expiry: "2027-01-01", Quantity: 20, Status: "active",
			Zone: "A", LocationLabel: "A-01-1", UnitLabel: "عدد", BuyPriceRial: 30000,
		},
		{
			ID: "b2", DrugID: "d2", BinID: "bin-r1", NameFa: "انسولین قلمی",
			BatchNo: "IN-1", Expiry: "2027-02-01", Quantity: 10, Status: "active",
			Zone: "R", LocationLabel: "R-01-1", UnitLabel: "قلم", BuyPriceRial: 700000,
		},
		{
			ID: "b3", DrugID: "d3", BinID: "bin-s1", NameFa: "مورفین سولفات",
			BatchNo: "MR-1", Expiry: "2027-03-01", Quantity: 5, Status: "active",
			Zone: "S", LocationLabel: "S-01-1", UnitLabel: "آمپول", IsControlled: true, BuyPriceRial: 90000,
		},
	})
	dr := newFakeDrugStore([]drug.Drug{
		{ID: "d1", NameFa: "آموکسی‌سیلین", GTIN: "6260001", GenericCode: "12345", TotalStock: 20, UnitCost: 45000},
		{ID: "d2", NameFa: "انسولین قلمی", GTIN: "6260002", GenericCode: "77881", TotalStock: 10, UnitCost: 890000},
		{ID: "d3", NameFa: "مورفین سولفات", GTIN: "6260003", GenericCode: "99001", TotalStock: 5, IsControlled: true, UnitCost: 120000},
	})
	cx := &fakeCardex{}
	au := &fakeAudit{}
	svc := NewService(cycles, sh, dr, cx, au)
	svc.now = func() time.Time { return time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC) }
	return svc, cycles, sh, dr, cx, au
}

var testActor = requestctx.Actor{UserID: "u1", Name: "اپراتور انبار", Role: "warehouse_operator", BranchID: "branch-central"}

func TestCreateAndBlindCountMasking(t *testing.T) {
	svc, _, _, _, _, _ := fixtureService()
	ctx := context.Background()

	// Blind cycle across all zones
	view, err := svc.Create(ctx, CreateCycleRequest{Zone: "all", Method: MethodBlind}, testActor)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if len(view.Items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(view.Items))
	}
	for _, it := range view.Items {
		if it.SystemQty != nil {
			t.Fatalf("expected blind pending item %s to hide systemQty", it.BatchID)
		}
	}

	// Count first item -> reveals systemQty & variance
	q := 18
	view, err = svc.RecordItem(ctx, view.ID, view.Items[0].ID, RecordItemRequest{
		Action:      "count",
		PhysicalQty: &q,
	}, testActor)
	if err != nil {
		t.Fatalf("RecordItem failed: %v", err)
	}
	if view.Items[0].SystemQty == nil || *view.Items[0].SystemQty != 20 {
		t.Fatalf("expected counted item systemQty=20, got %v", view.Items[0].SystemQty)
	}
	if view.Items[0].VarianceQty == nil || *view.Items[0].VarianceQty != -2 {
		t.Fatalf("expected variance -2, got %v", view.Items[0].VarianceQty)
	}
	if view.Items[1].SystemQty != nil {
		t.Fatalf("expected uncounted item to stay hidden")
	}

	// Switch to open mode -> all systemQty revealed
	openMethod := MethodOpen
	view, err = svc.UpdateSettings(ctx, view.ID, UpdateSettingsRequest{Method: &openMethod})
	if err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}
	for _, it := range view.Items {
		if it.SystemQty == nil {
			t.Fatalf("expected open mode item %s to expose systemQty", it.BatchID)
		}
	}

	// Zone filter validation when empty
	_, err = svc.Create(ctx, CreateCycleRequest{Zone: "C", Method: MethodBlind}, testActor)
	var appErr *errormap.AppError
	if !errors.As(err, &appErr) || appErr.HTTPStatus != 422 {
		t.Fatalf("expected 422 for empty zone C, got %v", err)
	}
}

func TestConfirmAdjustsBatchesCardexAuditAndTotalStock(t *testing.T) {
	svc, _, sh, dr, cx, au := fixtureService()
	ctx := context.Background()

	view, err := svc.Create(ctx, CreateCycleRequest{Zone: "all", Method: MethodOpen}, testActor)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	// Items are sorted by Zone: A (d1:20), R (d2:10), S (d3:5)
	// Shortage of 2 on d1 (2 * 30,000 = -60,000), High-variance shortage of 1 on d2 (-700,000), Surplus of 2 on d3 (+180,000)
	q1, q2, q3 := 18, 9, 7
	r2 := "شکستگی آمپول"
	r3 := "عدم ثبت رسید"
	if view, err = svc.RecordItem(ctx, view.ID, view.Items[0].ID, RecordItemRequest{Action: "count", PhysicalQty: &q1}, testActor); err != nil {
		t.Fatal(err)
	}
	if view, err = svc.RecordItem(ctx, view.ID, view.Items[1].ID, RecordItemRequest{Action: "count", PhysicalQty: &q2, VarianceReason: &r2}, testActor); err != nil {
		t.Fatal(err)
	}
	if view, err = svc.RecordItem(ctx, view.ID, view.Items[2].ID, RecordItemRequest{Action: "count", PhysicalQty: &q3, VarianceReason: &r3}, testActor); err != nil {
		t.Fatal(err)
	}

	// Unverified high-variance (>500k) blocks confirm unless supervisorConfirm or verified
	_, err = svc.Confirm(ctx, view.ID, ConfirmCycleRequest{SupervisorName: "دکتر رضایی"}, testActor, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected validation error when high variance is unverified")
	}

	// Verify item 2 explicitly, then confirm
	if view, err = svc.RecordItem(ctx, view.ID, view.Items[1].ID, RecordItemRequest{Action: "verify"}, testActor); err != nil {
		t.Fatal(err)
	}
	confirmed, err := svc.Confirm(ctx, view.ID, ConfirmCycleRequest{SupervisorName: "دکتر رضایی"}, testActor, "127.0.0.1")
	if err != nil {
		t.Fatalf("Confirm failed: %v", err)
	}
	if confirmed.Status != StatusConfirmed || !strings.HasPrefix(confirmed.AdjustmentDocNo, "ADJ-") {
		t.Fatalf("unexpected confirmed state: %+v", confirmed)
	}
	if confirmed.Summary.ShortageUnits != 3 || confirmed.Summary.SurplusUnits != 2 {
		t.Fatalf("unexpected summary: %+v", confirmed.Summary)
	}
	if confirmed.Summary.NetVarianceRial != -580000 {
		t.Fatalf("expected netVarianceRial -580000, got %d", confirmed.Summary.NetVarianceRial)
	}

	// Verify batches, drugs.totalStock, cardex, audit
	if sh.batches["b1"].Quantity != 18 || sh.batches["b2"].Quantity != 9 || sh.batches["b3"].Quantity != 7 {
		t.Fatalf("batches not updated: %+v", sh.batches)
	}
	if dr.drugs["d1"].TotalStock != 18 || dr.drugs["d2"].TotalStock != 9 || dr.drugs["d3"].TotalStock != 7 {
		t.Fatalf("drug totalStock not synced: %+v", dr.drugs)
	}
	if len(cx.movements) != 3 {
		t.Fatalf("expected 3 cardex movements, got %d", len(cx.movements))
	}
	if len(au.events) != 1 || au.events[0].Action != "stocktake_adjust" || !au.events[0].IsControlledSubstance {
		t.Fatalf("unexpected audit event: %+v", au.events)
	}

	// Second confirm must return 409 conflict
	_, err = svc.Confirm(ctx, view.ID, ConfirmCycleRequest{SupervisorName: "دکتر رضایی"}, testActor, "127.0.0.1")
	var appErr *errormap.AppError
	if !errors.As(err, &appErr) || appErr.HTTPStatus != 409 {
		t.Fatalf("expected 409 on double confirm, got %v", err)
	}
}

func TestConfirmRollbackOnAuditFailure(t *testing.T) {
	svc, _, sh, dr, cx, au := fixtureService()
	ctx := context.Background()

	view, err := svc.Create(ctx, CreateCycleRequest{Zone: "A", Method: MethodOpen}, testActor)
	if err != nil {
		t.Fatal(err)
	}
	q := 0
	if view, err = svc.RecordItem(ctx, view.ID, view.Items[0].ID, RecordItemRequest{Action: "count", PhysicalQty: &q}, testActor); err != nil {
		t.Fatal(err)
	}

	au.fail = true
	_, err = svc.Confirm(ctx, view.ID, ConfirmCycleRequest{
		SupervisorName:    "دکتر رضایی",
		SupervisorConfirm: true,
	}, testActor, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected error from audit failure")
	}

	// Batch & Drug & Cardex & Cycle status must be rolled back
	if sh.batches["b1"].Quantity != 20 || sh.batches["b1"].Status != "active" {
		t.Fatalf("batch not rolled back: %+v", sh.batches["b1"])
	}
	if dr.drugs["d1"].TotalStock != 20 {
		t.Fatalf("drug totalStock not rolled back: %d", dr.drugs["d1"].TotalStock)
	}
	if len(cx.movements) != 0 {
		t.Fatalf("cardex movements not rolled back: %d", len(cx.movements))
	}
	reloaded, err := svc.Get(ctx, view.ID)
	if err != nil || reloaded.Status != StatusActive {
		t.Fatalf("cycle status not reverted to active: %+v, err=%v", reloaded, err)
	}
}

func TestExportCSVAndList(t *testing.T) {
	svc, _, _, _, _, _ := fixtureService()
	ctx := context.Background()

	view, err := svc.Create(ctx, CreateCycleRequest{Zone: "A", Method: MethodBlind}, testActor)
	if err != nil {
		t.Fatal(err)
	}
	data, filename, err := svc.ExportCSV(ctx, view.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(filename, ".csv") || !strings.Contains(string(data), "محرمانه") {
		t.Fatalf("unexpected CSV output: filename=%s, body=%s", filename, string(data))
	}
	list, err := svc.List(ctx, StatusActive, pagination.Params{Page: 1, PageSize: 10})
	if err != nil || list.Total != 1 {
		t.Fatalf("unexpected list result: %+v, err=%v", list, err)
	}
}
