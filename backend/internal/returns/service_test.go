package returns

import (
	"context"
	"errors"
	"net/http"
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

type fakeReturnRepo struct {
	items map[string]DistributorReturn
}

func newFakeReturnRepo() *fakeReturnRepo {
	return &fakeReturnRepo{items: map[string]DistributorReturn{}}
}

func (f *fakeReturnRepo) Insert(_ context.Context, ret DistributorReturn) error {
	f.items[ret.ID] = ret
	return nil
}

func (f *fakeReturnRepo) Get(_ context.Context, id string) (*DistributorReturn, error) {
	ret, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	copyRet := ret
	return &copyRet, nil
}

func (f *fakeReturnRepo) List(_ context.Context, status, distributorID string, page, pageSize int) ([]DistributorReturn, int64, error) {
	var out []DistributorReturn
	for _, r := range f.items {
		if status != "" && r.Status != status {
			continue
		}
		if distributorID != "" && r.DistributorID != distributorID {
			continue
		}
		out = append(out, r)
	}
	return out, int64(len(out)), nil
}

func (f *fakeReturnRepo) CountByStatus(_ context.Context, status string) (int64, error) {
	var n int64
	for _, r := range f.items {
		if r.Status == status {
			n++
		}
	}
	return n, nil
}

func (f *fakeReturnRepo) Replace(_ context.Context, ret DistributorReturn) error {
	f.items[ret.ID] = ret
	return nil
}

func (f *fakeReturnRepo) ClaimForConfirm(_ context.Context, id string) (bool, error) {
	r, ok := f.items[id]
	if !ok || r.Status != StatusDraft {
		return false, nil
	}
	r.Status = StatusConfirming
	f.items[id] = r
	return true, nil
}

func (f *fakeReturnRepo) RevertToDraft(_ context.Context, id string) error {
	r, ok := f.items[id]
	if !ok {
		return nil
	}
	r.Status = StatusDraft
	r.ReturnNo = ""
	r.ConfirmedAt = nil
	f.items[id] = r
	return nil
}

type fakeShelfStore struct {
	batches map[string]shelf.StockBatch
}

func newFakeShelfStore(list ...shelf.StockBatch) *fakeShelfStore {
	m := map[string]shelf.StockBatch{}
	for _, b := range list {
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
	cp := b
	return &cp, nil
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

func (f *fakeShelfStore) UpdateBatchQuantity(_ context.Context, id string, quantity int) error {
	b, ok := f.batches[id]
	if !ok {
		return nil
	}
	b.Quantity = quantity
	if quantity <= 0 {
		b.Status = "depleted"
	}
	f.batches[id] = b
	return nil
}

func (f *fakeShelfStore) UpdateBatchStatus(_ context.Context, id, status string) error {
	b, ok := f.batches[id]
	if !ok {
		return nil
	}
	b.Status = status
	f.batches[id] = b
	return nil
}

type fakeDrugStore struct {
	drugs map[string]drug.Drug
}

func newFakeDrugStore(list ...drug.Drug) *fakeDrugStore {
	m := map[string]drug.Drug{}
	for _, d := range list {
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

func (f *fakeDrugStore) Get(_ context.Context, id string) (*drug.Drug, error) {
	d, ok := f.drugs[id]
	if !ok {
		return nil, nil
	}
	cp := d
	return &cp, nil
}

func (f *fakeDrugStore) UpdateStockSummary(_ context.Context, id string, totalStock int, nearestExpiry string) error {
	d, ok := f.drugs[id]
	if !ok {
		return nil
	}
	d.TotalStock = totalStock
	if nearestExpiry != "" {
		d.NearestExpiry = nearestExpiry
	}
	f.drugs[id] = d
	return nil
}

type fakeCardex struct {
	movements []cardex.Movement
	failNext  bool
}

func (f *fakeCardex) Append(_ context.Context, in cardex.AppendInput) (cardex.Movement, error) {
	if f.failNext {
		return cardex.Movement{}, errors.New("cardex down")
	}
	m := cardex.Movement{
		ID:      "mv-" + in.BatchNo,
		DrugID:  in.DrugID,
		Type:    in.Type,
		BatchNo: in.BatchNo,
		QtyIn:   in.QtyIn,
		QtyOut:  in.QtyOut,
		Note:    in.Note,
	}
	f.movements = append(f.movements, m)
	return m, nil
}

func (f *fakeCardex) Delete(_ context.Context, id string) error {
	var filtered []cardex.Movement
	for _, m := range f.movements {
		if m.ID != id {
			filtered = append(filtered, m)
		}
	}
	f.movements = filtered
	return nil
}

type fakeAudit struct {
	events   []audit.Event
	failNext bool
}

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	if f.failNext {
		return audit.Event{}, errors.New("audit down")
	}
	ev := audit.Event{
		ID:                    "aud-1",
		Action:                in.Action,
		EntityType:            in.EntityType,
		EntityID:              in.EntityID,
		EntityLabel:           in.EntityLabel,
		Description:           in.Description,
		IsControlledSubstance: in.IsControlledSubstance,
	}
	f.events = append(f.events, ev)
	return ev, nil
}

func testActor() requestctx.Actor {
	return requestctx.Actor{
		UserID:   "user-operator",
		Name:     "اپراتور انبار",
		Role:     "warehouse_operator",
		Initials: "اا",
		BranchID: "branch-central",
	}
}

func TestListEligibleWindowDistributorFallbackAndStatuses(t *testing.T) {
	now := time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)
	drugs := newFakeDrugStore(
		drug.Drug{ID: "d-amox", NameFa: "آموکسی‌سیلین", DistributorID: "daroupakhsh", GenericCode: "12345", UnitCost: 45000, TotalStock: 25},
		drug.Drug{ID: "d-ins", NameFa: "انسولین قلمی", DistributorID: "hejrat", GenericCode: "77881", UnitCost: 890000, TotalStock: 8},
		drug.Drug{ID: "d-mor", NameFa: "مورفین سولفات", DistributorID: "razi", GenericCode: "99001", IsControlled: true, UnitCost: 120000, TotalStock: 12},
	)
	shelfStore := newFakeShelfStore(
		shelf.StockBatch{ID: "b1", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-1", Expiry: "2026-12-01", Quantity: 20, Status: "active", Distributor: "داروپخش", BuyPriceRial: 32000},
		shelf.StockBatch{ID: "b2", DrugID: "d-ins", NameFa: "انسولین قلمی", BatchNo: "IN-1", Expiry: "2026-11-20", Quantity: 8, Status: "active", BuyPriceRial: 700000},
		shelf.StockBatch{ID: "b3", DrugID: "d-mor", NameFa: "مورفین سولفات", BatchNo: "MR-1", Expiry: "2027-03-01", Quantity: 12, Status: "active", BuyPriceRial: 90000}, // 109 days away
		shelf.StockBatch{ID: "b4", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-Q", Expiry: "2026-11-25", Quantity: 5, Status: "quarantined", Distributor: "داروپخش"},
		shelf.StockBatch{ID: "b5", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-M", Expiry: "2027-08-01", Quantity: 4, Status: "marked_return", Distributor: "شرکت توزیع داروپخش"},
		shelf.StockBatch{ID: "b6", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-0", Expiry: "2026-11-25", Quantity: 0, Status: "depleted", Distributor: "داروپخش"},
	)
	repo := newFakeReturnRepo()
	repo.items["r-pending"] = DistributorReturn{ID: "r-pending", Status: StatusConfirmed}
	svc := NewService(repo, shelfStore, drugs, &fakeCardex{}, &fakeAudit{})
	svc.now = func() time.Time { return now }

	// 90-day window: includes b1 (19d), b2 (8d, fallback hejrat), b5 (marked_return). Excludes b3 (109d), b4 (quarantined), b6 (depleted).
	res90, err := svc.ListEligible(context.Background(), 90, "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res90.KPIs.TotalBatches != 3 {
		t.Fatalf("expected 3 eligible batches in 90d window, got %d", res90.KPIs.TotalBatches)
	}
	if res90.KPIs.UrgentBatches != 2 {
		t.Fatalf("expected 2 urgent batches (<=25d), got %d", res90.KPIs.UrgentBatches)
	}
	if res90.KPIs.ActiveDistributors != 2 {
		t.Fatalf("expected 2 active distributors, got %d", res90.KPIs.ActiveDistributors)
	}
	if res90.KPIs.PendingVisitorSlips != 1 {
		t.Fatalf("expected 1 pending visitor slip, got %d", res90.KPIs.PendingVisitorSlips)
	}
	// Total value: b1 (20*32000=640000) + b2 (8*700000=5600000) + b5 (4*45000=180000) = 6,420,000
	if res90.KPIs.TotalValueRial != 6420000 {
		t.Fatalf("expected total value 6420000, got %d", res90.KPIs.TotalValueRial)
	}

	// 120-day window: includes b3 (razi, 109d) as well.
	res120, err := svc.ListEligible(context.Background(), 120, "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res120.KPIs.TotalBatches != 4 || res120.KPIs.ActiveDistributors != 3 {
		t.Fatalf("expected 4 batches & 3 distributors in 120d window, got %+v", res120.KPIs)
	}

	// Search filter for "مورفین"
	resSearch, err := svc.ListEligible(context.Background(), 120, "مورفین", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resSearch.Groups) != 1 || resSearch.Groups[0].DistributorID != "razi" {
		t.Fatalf("expected only razi group on search, got %+v", resSearch.Groups)
	}
}

func TestCreateValidationAndMixedDistributors(t *testing.T) {
	drugs := newFakeDrugStore(
		drug.Drug{ID: "d-amox", NameFa: "آموکسی‌سیلین", DistributorID: "daroupakhsh"},
		drug.Drug{ID: "d-ins", NameFa: "انسولین قلمی", DistributorID: "hejrat"},
	)
	shelfStore := newFakeShelfStore(
		shelf.StockBatch{ID: "b1", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-1", Expiry: "2026-12-01", Quantity: 5, Status: "active", Distributor: "داروپخش"},
		shelf.StockBatch{ID: "b2", DrugID: "d-ins", NameFa: "انسولین قلمی", BatchNo: "IN-1", Expiry: "2026-11-20", Quantity: 3, Status: "active"},
	)
	svc := NewService(newFakeReturnRepo(), shelfStore, drugs, &fakeCardex{}, &fakeAudit{})

	if _, err := svc.Create(context.Background(), CreateRequest{}, testActor()); err == nil {
		t.Fatal("expected validation error for empty lines")
	}

	if _, err := svc.Create(context.Background(), CreateRequest{
		Lines: []CreateLineInput{{BatchID: "b1", Quantity: 10}},
	}, testActor()); err == nil {
		t.Fatal("expected validation error when quantity exceeds batch stock")
	}

	if _, err := svc.Create(context.Background(), CreateRequest{
		Lines: []CreateLineInput{
			{BatchID: "b1", Quantity: 1},
			{BatchID: "b2", Quantity: 1},
		},
	}, testActor()); err == nil {
		t.Fatal("expected validation error for mixed distributors in single return slip")
	}
}

func TestConfirmDeductsStockSyncsDrugRecordsCardexAuditAndSettles(t *testing.T) {
	now := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	drugs := newFakeDrugStore(
		drug.Drug{ID: "d-amox", NameFa: "آموکسی‌سیلین", DistributorID: "daroupakhsh", TotalStock: 25, NearestExpiry: "2026-12-01"},
	)
	shelfStore := newFakeShelfStore(
		shelf.StockBatch{ID: "b1", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-1", Expiry: "2026-12-01", Quantity: 20, Status: "active", Distributor: "داروپخش", BuyPriceRial: 30000},
		shelf.StockBatch{ID: "b2", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-2", Expiry: "2027-06-01", Quantity: 5, Status: "active", Distributor: "داروپخش", BuyPriceRial: 35000},
	)
	cdx := &fakeCardex{}
	aud := &fakeAudit{}
	svc := NewService(newFakeReturnRepo(), shelfStore, drugs, cdx, aud)
	svc.now = func() time.Time { return now }

	draft, err := svc.Create(context.Background(), CreateRequest{
		WindowDays: 90,
		Lines: []CreateLineInput{
			{BatchID: "b1", Quantity: 20, Reason: "بازه ۳ ماهه"},
			{BatchID: "b2", Quantity: 2, Reason: "توافق پخش"},
		},
	}, testActor())
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if draft.TotalQty != 22 || draft.TotalValueRial != 20*30000+2*35000 {
		t.Fatalf("unexpected draft totals: qty=%d val=%d", draft.TotalQty, draft.TotalValueRial)
	}

	confirmed, err := svc.Confirm(context.Background(), draft.ID, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("confirm failed: %v", err)
	}
	if confirmed.Status != StatusConfirmed || confirmed.ReturnNo == "" {
		t.Fatalf("unexpected confirmed state: %+v", confirmed)
	}

	// b1 fully depleted, b2 partially reduced to 3
	if b1 := shelfStore.batches["b1"]; b1.Quantity != 0 || b1.Status != "depleted" {
		t.Fatalf("expected b1 depleted at 0, got %+v", b1)
	}
	if b2 := shelfStore.batches["b2"]; b2.Quantity != 3 || b2.Status != "active" {
		t.Fatalf("expected b2 active at 3, got %+v", b2)
	}
	if d := drugs.drugs["d-amox"]; d.TotalStock != 3 || d.NearestExpiry != "2027-06-01" {
		t.Fatalf("expected drug summary synced to 3 / 2027-06-01, got %+v", d)
	}
	if len(cdx.movements) != 2 || cdx.movements[0].Type != "outbound" {
		t.Fatalf("expected 2 outbound cardex movements, got %+v", cdx.movements)
	}
	if len(aud.events) != 1 || aud.events[0].Action != "return_to_distributor" {
		t.Fatalf("expected return_to_distributor audit event, got %+v", aud.events)
	}

	// Re-confirm returns 409 conflict
	if _, err := svc.Confirm(context.Background(), draft.ID, testActor(), "127.0.0.1"); err == nil {
		t.Fatal("expected 409 conflict on second confirm")
	} else if appErr, ok := err.(*errormap.AppError); !ok || appErr.HTTPStatus != http.StatusConflict {
		t.Fatalf("expected AppError 409, got %v", err)
	}

	// Settle transitions confirmed -> settled
	settled, err := svc.Settle(context.Background(), draft.ID, SettleRequest{
		CreditNoteNo: "CN-403-99",
		VisitorName:  "مهندس کاظمی",
	}, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("settle failed: %v", err)
	}
	if settled.Status != StatusSettled || settled.CreditNoteNo != "CN-403-99" {
		t.Fatalf("unexpected settled view: %+v", settled)
	}

	listRes, err := svc.List(context.Background(), StatusSettled, "daroupakhsh", pagination.Params{Page: 1, PageSize: 10})
	if err != nil || listRes.Total != 1 {
		t.Fatalf("expected 1 settled slip in list, got %+v (err=%v)", listRes, err)
	}
}

func TestConfirmRollbackOnAuditFailureRestoresStockAndDraft(t *testing.T) {
	now := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	drugs := newFakeDrugStore(
		drug.Drug{ID: "d-amox", NameFa: "آموکسی‌سیلین", DistributorID: "daroupakhsh", TotalStock: 20, NearestExpiry: "2026-12-01"},
	)
	shelfStore := newFakeShelfStore(
		shelf.StockBatch{ID: "b1", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-1", Expiry: "2026-12-01", Quantity: 20, Status: "marked_return", Distributor: "داروپخش", BuyPriceRial: 30000},
	)
	cdx := &fakeCardex{}
	aud := &fakeAudit{failNext: true}
	svc := NewService(newFakeReturnRepo(), shelfStore, drugs, cdx, aud)
	svc.now = func() time.Time { return now }

	draft, err := svc.Create(context.Background(), CreateRequest{
		Lines: []CreateLineInput{{BatchID: "b1", Quantity: 20}},
	}, testActor())
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	if _, err := svc.Confirm(context.Background(), draft.ID, testActor(), "127.0.0.1"); err == nil {
		t.Fatal("expected error when audit append fails")
	}

	if b1 := shelfStore.batches["b1"]; b1.Quantity != 20 || b1.Status != "marked_return" {
		t.Fatalf("expected b1 rolled back to 20 / marked_return, got %+v", b1)
	}
	if d := drugs.drugs["d-amox"]; d.TotalStock != 20 || d.NearestExpiry != "2026-12-01" {
		t.Fatalf("expected drug summary rolled back, got %+v", d)
	}
	if len(cdx.movements) != 0 {
		t.Fatalf("expected cardex movements rolled back, got %+v", cdx.movements)
	}
	got, err := svc.Get(context.Background(), draft.ID)
	if err != nil || got.Status != StatusDraft {
		t.Fatalf("expected slip reverted to draft, got %+v (err=%v)", got, err)
	}
}
