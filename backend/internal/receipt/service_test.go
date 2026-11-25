package receipt

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"testing"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

func TestCreateDraft(t *testing.T) {
	svc := newDraftService(newFakeRepo(), newFakeDrugs())
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}

	view, err := svc.Create(context.Background(), validHeader(), actor)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if view.ID == "" {
		t.Fatal("expected id")
	}
	if view.Status != StatusDraft {
		t.Fatalf("status = %s", view.Status)
	}
	if view.CurrentStep != 1 {
		t.Fatalf("step = %d", view.CurrentStep)
	}
	if view.Lines == nil || len(view.Lines) != 0 {
		t.Fatalf("lines = %#v", view.Lines)
	}
	if view.CreatedBy.UserID != actor.UserID || view.CreatedBy.Name != actor.Name || view.CreatedBy.Role != actor.Role {
		t.Fatalf("createdBy = %+v", view.CreatedBy)
	}
	if view.Header.InvoiceNo != "F-1" || view.Header.PurchaseType != "official_ttac" {
		t.Fatalf("header = %+v", view.Header)
	}
	if view.GrossRial != 0 || view.NetRial != 0 {
		t.Fatalf("totals gross=%d net=%d", view.GrossRial, view.NetRial)
	}
	if view.CreatedAt.IsZero() || view.UpdatedAt.IsZero() {
		t.Fatal("expected timestamps")
	}

	got, err := svc.Get(context.Background(), view.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusDraft || got.CurrentStep != 1 || len(got.Lines) != 0 {
		t.Fatalf("persisted = %+v", got.Receipt)
	}
}

func TestAddLineReflectsTotalsOnGet(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن", GTIN: "06261234567890", UnitLabel: "عدد"}
	svc := newDraftService(newFakeRepo(), drugs)
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}

	header := validHeader()
	header.DiscountRial = 500
	header.VatRial = 100
	created, err := svc.Create(context.Background(), header, actor)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	added, err := svc.AddLine(context.Background(), created.ID, LineInput{
		DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 2, BuyPriceRial: 1000,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(added.Lines) != 1 {
		t.Fatalf("lines = %d", len(added.Lines))
	}
	line := added.Lines[0]
	if line.ID == "" || line.NameFa != "استامینوفن" || line.GTIN != "06261234567890" || line.UnitLabel != "عدد" {
		t.Fatalf("line = %+v", line)
	}
	if added.GrossRial != 2000 || added.NetRial != 1600 {
		t.Fatalf("add totals gross=%d net=%d", added.GrossRial, added.NetRial)
	}

	got, err := svc.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.GrossRial != 2000 || got.NetRial != 1600 {
		t.Fatalf("get totals gross=%d net=%d", got.GrossRial, got.NetRial)
	}
	if len(got.Lines) != 1 || got.Lines[0].Quantity != 2 || got.Lines[0].BuyPriceRial != 1000 {
		t.Fatalf("persisted line = %+v", got.Lines)
	}
}

func TestPatchLineLocation(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن", UnitLabel: "عدد"}
	svc := newDraftService(newFakeRepo(), drugs)
	created, err := svc.Create(context.Background(), validHeader(), requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added, err := svc.AddLine(context.Background(), created.ID, LineInput{
		DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1, BuyPriceRial: 1000,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}

	loc := "B-12"
	bin := "bin-1"
	patched, err := svc.PatchLine(context.Background(), created.ID, added.Lines[0].ID, LinePatch{
		LocationLabel: &loc,
		BinID:         &bin,
	})
	if err != nil {
		t.Fatalf("patch line: %v", err)
	}
	if patched.Lines[0].LocationLabel != "B-12" || patched.Lines[0].BinID != "bin-1" {
		t.Fatalf("line = %+v", patched.Lines[0])
	}
	if patched.Lines[0].NameFa != "استامینوفن" || patched.Lines[0].BatchNo != "B-1" {
		t.Fatalf("other fields changed: %+v", patched.Lines[0])
	}

	got, err := svc.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Lines[0].LocationLabel != "B-12" || got.GrossRial != 1000 {
		t.Fatalf("persisted = %+v totals=%d", got.Lines[0], got.GrossRial)
	}
}

func TestPatchLineSwapsDrugGTIN(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن", GTIN: "06261234567890", UnitLabel: "عدد"}
	drugs.items["d2"] = &drug.Drug{ID: "d2", NameFa: "ایبوپروفن", GTIN: "06260000000002", UnitLabel: "جعبه"}
	svc := newDraftService(newFakeRepo(), drugs)
	created, err := svc.Create(context.Background(), validHeader(), requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added, err := svc.AddLine(context.Background(), created.ID, LineInput{
		DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1, BuyPriceRial: 1000,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}

	next := "d2"
	patched, err := svc.PatchLine(context.Background(), created.ID, added.Lines[0].ID, LinePatch{DrugID: &next})
	if err != nil {
		t.Fatalf("swap: %v", err)
	}
	line := patched.Lines[0]
	if line.DrugID != "d2" || line.NameFa != "ایبوپروفن" || line.GTIN != "06260000000002" || line.UnitLabel != "جعبه" {
		t.Fatalf("swapped line = %+v", line)
	}

	back := "d1"
	customGTIN := "999"
	customUnit := "ویال"
	kept, err := svc.PatchLine(context.Background(), created.ID, line.ID, LinePatch{
		DrugID: &back, GTIN: &customGTIN, UnitLabel: &customUnit,
	})
	if err != nil {
		t.Fatalf("swap with explicit gtin: %v", err)
	}
	line = kept.Lines[0]
	if line.DrugID != "d1" || line.NameFa != "استامینوفن" || line.GTIN != "999" || line.UnitLabel != "ویال" {
		t.Fatalf("explicit gtin/unit overwritten: %+v", line)
	}
}

func TestPatchLineBlankDrugID(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن", GTIN: "06261234567890", UnitLabel: "عدد"}
	svc := newDraftService(newFakeRepo(), drugs)
	created, err := svc.Create(context.Background(), validHeader(), requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added, err := svc.AddLine(context.Background(), created.ID, LineInput{
		DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}

	blank := "  "
	_, err = svc.PatchLine(context.Background(), created.ID, added.Lines[0].ID, LinePatch{DrugID: &blank})
	assertField(t, err, "drugId", "شناسه دارو الزامی است")

	got, err := svc.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Lines[0].DrugID != "d1" || got.Lines[0].GTIN != "06261234567890" {
		t.Fatalf("blank drugId persisted: %+v", got.Lines[0])
	}

	missing := "missing"
	_, err = svc.PatchLine(context.Background(), created.ID, added.Lines[0].ID, LinePatch{DrugID: &missing})
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "not_found" || app.Message != "دارو یافت نشد" {
		t.Fatalf("missing drug: %v", err)
	}
}

func TestMutatingConfirmedReceiptRejected(t *testing.T) {
	repo := newFakeRepo()
	repo.items["c1"] = Receipt{
		ID: "c1", Status: StatusConfirmed, CurrentStep: 3,
		Header: validHeader(), Lines: []Line{{ID: "l1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1}},
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن"}
	svc := newDraftService(repo, drugs)
	ctx := context.Background()

	_, err := svc.AddLine(ctx, "c1", LineInput{DrugID: "d1", BatchNo: "B-2", Expiry: "2027-02-01", Quantity: 1})
	assertConflict(t, err)
	dist := "دیگر"
	_, err = svc.Patch(ctx, "c1", HeaderPatch{Distributor: &dist})
	assertConflict(t, err)
	loc := "A-1"
	_, err = svc.PatchLine(ctx, "c1", "l1", LinePatch{LocationLabel: &loc})
	assertConflict(t, err)
	_, err = svc.DeleteLine(ctx, "c1", "l1")
	assertConflict(t, err)

	got, err := svc.Get(ctx, "c1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusConfirmed || len(got.Lines) != 1 || got.Lines[0].BatchNo != "B-1" {
		t.Fatalf("confirmed mutated: %+v", got.Receipt)
	}
}

func TestCreateHeaderValidation(t *testing.T) {
	svc := newDraftService(newFakeRepo(), newFakeDrugs())
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}
	cases := []struct {
		name  string
		edit  func(*Header)
		field string
		msg   string
	}{
		{name: "invoice", edit: func(h *Header) { h.InvoiceNo = "  " }, field: "invoiceNo", msg: "شماره فاکتور الزامی است"},
		{name: "distributor", edit: func(h *Header) { h.Distributor = "" }, field: "distributor", msg: "شرکت پخش الزامی است"},
		{name: "issued", edit: func(h *Header) { h.IssuedAt = "" }, field: "issuedAt", msg: "تاریخ صدور الزامی است"},
		{name: "received", edit: func(h *Header) { h.ReceivedAt = "" }, field: "receivedAt", msg: "تاریخ دریافت الزامی است"},
		{name: "warehouse", edit: func(h *Header) { h.WarehouseLabel = "" }, field: "warehouseLabel", msg: "انبار الزامی است"},
		{name: "purchase", edit: func(h *Header) { h.PurchaseType = "cash" }, field: "purchaseType", msg: "نوع خرید نامعتبر است"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := validHeader()
			tc.edit(&h)
			_, err := svc.Create(context.Background(), h, actor)
			assertField(t, err, tc.field, tc.msg)
		})
	}
}

func TestAddLineValidation(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن"}
	svc := newDraftService(newFakeRepo(), drugs)
	created, err := svc.Create(context.Background(), validHeader(), requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	base := LineInput{DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1}
	cases := []struct {
		name  string
		edit  func(*LineInput)
		field string
		msg   string
	}{
		{name: "drug", edit: func(l *LineInput) { l.DrugID = "" }, field: "drugId", msg: "شناسه دارو الزامی است"},
		{name: "batch", edit: func(l *LineInput) { l.BatchNo = " " }, field: "batchNo", msg: "شماره سری ساخت الزامی است"},
		{name: "expiry", edit: func(l *LineInput) { l.Expiry = "" }, field: "expiry", msg: "تاریخ انقضا الزامی است"},
		{name: "qty", edit: func(l *LineInput) { l.Quantity = 0 }, field: "quantity", msg: "تعداد باید بزرگ‌تر از صفر باشد"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := base
			tc.edit(&in)
			_, err := svc.AddLine(context.Background(), created.ID, in)
			assertField(t, err, tc.field, tc.msg)
		})
	}

	_, err = svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "missing", BatchNo: "B-9", Expiry: "2027-01-01", Quantity: 1})
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "not_found" || app.Message != "دارو یافت نشد" {
		t.Fatalf("missing drug: %v", err)
	}
}

func TestPatchAndDeleteLine(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "استامینوفن", UnitLabel: "عدد"}
	svc := newDraftService(newFakeRepo(), drugs)
	created, err := svc.Create(context.Background(), validHeader(), requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added, err := svc.AddLine(context.Background(), created.ID, LineInput{
		DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 4, BuyPriceRial: 250,
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	step := 2
	note := "یادداشت"
	patched, err := svc.Patch(context.Background(), created.ID, HeaderPatch{CurrentStep: &step, Note: &note})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	if patched.CurrentStep != 2 || patched.Header.Note != "یادداشت" || patched.Header.InvoiceNo != "F-1" {
		t.Fatalf("header patch = %+v step=%d", patched.Header, patched.CurrentStep)
	}

	got, err := svc.DeleteLine(context.Background(), created.ID, added.Lines[0].ID)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if len(got.Lines) != 0 || got.GrossRial != 0 || got.NetRial != 0 {
		t.Fatalf("after delete lines=%d gross=%d net=%d", len(got.Lines), got.GrossRial, got.NetRial)
	}

	_, err = svc.DeleteLine(context.Background(), created.ID, "missing")
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "not_found" {
		t.Fatalf("missing line: %v", err)
	}
}

func TestListFiltersDrafts(t *testing.T) {
	repo := newFakeRepo()
	repo.items["c1"] = Receipt{ID: "c1", Status: StatusConfirmed, Header: validHeader(), Lines: []Line{}, UpdatedAt: time.Now().UTC()}
	svc := newDraftService(repo, newFakeDrugs())
	created, err := svc.Create(context.Background(), validHeader(), requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	res, err := svc.List(context.Background(), StatusDraft, pagination.Params{Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if res.Total != 1 || len(res.Items) != 1 || res.Items[0].ID != created.ID {
		t.Fatalf("list = %+v", res)
	}
	if res.Items[0].GrossRial != 0 || res.Items[0].NetRial != 0 {
		t.Fatalf("list totals = %d/%d", res.Items[0].GrossRial, res.Items[0].NetRial)
	}
}

func TestGetMissing(t *testing.T) {
	svc := newDraftService(newFakeRepo(), newFakeDrugs())
	_, err := svc.Get(context.Background(), "nope")
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "not_found" || app.Message != "رسید یافت نشد" {
		t.Fatalf("got %v", err)
	}
}

func validHeader() Header {
	return Header{
		InvoiceNo:      "F-1",
		Distributor:    "پخش",
		IssuedAt:       "2024-11-11",
		ReceivedAt:     "2024-11-11",
		WarehouseLabel: "مرکزی",
		PurchaseType:   "official_ttac",
	}
}

func assertConflict(t *testing.T, err error) {
	t.Helper()
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "conflict" {
		t.Fatalf("expected conflict, got %v", err)
	}
}

func assertField(t *testing.T, err error, field, msg string) {
	t.Helper()
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "validation_error" {
		t.Fatalf("expected validation, got %v", err)
	}
	if app.Message != "لطفاً فیلدهای الزامی را تکمیل کنید" {
		t.Fatalf("message = %s", app.Message)
	}
	fields, ok := app.Fields.(map[string]string)
	if !ok {
		t.Fatalf("fields type %T", app.Fields)
	}
	if fields[field] != msg {
		t.Fatalf("field %s = %q in %v", field, fields[field], fields)
	}
}

type fakeRepo struct {
	items     map[string]Receipt
	claims    int
	maxClaims int
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{items: map[string]Receipt{}}
}

func (f *fakeRepo) Insert(_ context.Context, rec Receipt) error {
	if _, ok := f.items[rec.ID]; ok {
		return errors.New("duplicate")
	}
	f.items[rec.ID] = cloneReceipt(rec)
	return nil
}

func (f *fakeRepo) Get(_ context.Context, id string) (*Receipt, error) {
	rec, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	copied := cloneReceipt(rec)
	return &copied, nil
}

func (f *fakeRepo) List(_ context.Context, status string, page, pageSize int) ([]Receipt, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 25
	}
	all := make([]Receipt, 0, len(f.items))
	for _, rec := range f.items {
		if status != "" && rec.Status != status {
			continue
		}
		all = append(all, cloneReceipt(rec))
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].UpdatedAt.Equal(all[j].UpdatedAt) {
			return all[i].ID > all[j].ID
		}
		return all[i].UpdatedAt.After(all[j].UpdatedAt)
	})
	total := int64(len(all))
	start := (page - 1) * pageSize
	if start >= len(all) {
		return []Receipt{}, total, nil
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], total, nil
}

func (f *fakeRepo) Replace(_ context.Context, rec Receipt) error {
	if _, ok := f.items[rec.ID]; !ok {
		return errors.New("missing")
	}
	f.items[rec.ID] = cloneReceipt(rec)
	return nil
}

func (f *fakeRepo) ClaimDraft(_ context.Context, id string) (bool, error) {
	f.claims++
	if f.maxClaims > 0 && f.claims > f.maxClaims {
		return false, nil
	}
	rec, ok := f.items[id]
	if !ok || rec.Status != StatusDraft {
		return false, nil
	}
	now := time.Now().UTC()
	rec.Status = StatusConfirmed
	rec.ConfirmedAt = &now
	rec.UpdatedAt = now
	f.items[id] = cloneReceipt(rec)
	return true, nil
}

func cloneReceipt(rec Receipt) Receipt {
	if rec.Lines != nil {
		lines := make([]Line, len(rec.Lines))
		copy(lines, rec.Lines)
		rec.Lines = lines
	}
	if rec.CreatedBatchIDs != nil {
		ids := make([]string, len(rec.CreatedBatchIDs))
		copy(ids, rec.CreatedBatchIDs)
		rec.CreatedBatchIDs = ids
	}
	return rec
}

type fakeDrugs struct {
	items map[string]*drug.Drug
}

func newFakeDrugs() *fakeDrugs {
	return &fakeDrugs{items: map[string]*drug.Drug{}}
}

func (f *fakeDrugs) Get(_ context.Context, id string) (*drug.Drug, error) {
	d, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	copied := *d
	return &copied, nil
}

func newDraftService(repo receiptStore, drugs drugStore) *Service {
	return NewService(repo, drugs, &fakeBatches{}, &fakeDeleter{}, &fakeMovements{}, &fakeAudit{})
}

func TestConfirmCreatesBatchesAndOneAudit(t *testing.T) {
	repo := newFakeRepo()
	now := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	repo.items["r1"] = Receipt{
		ID: "r1", Status: StatusDraft, CurrentStep: 3,
		Header: validHeader(),
		Lines: []Line{
			{ID: "l1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 2, UnitLabel: "عدد", BuyPriceRial: 1500, ConsumerPriceRial: 2000, LocationLabel: "B-12"},
			{ID: "l2", DrugID: "d-ctrl", NameFa: "مورفین", BatchNo: "B-2", Expiry: "2027-06-01", Quantity: 1, UnitLabel: "آمپول", BuyPriceRial: 90000, BinID: "bin-s"},
		},
		CreatedAt: now.Add(-time.Hour), UpdatedAt: now.Add(-time.Hour),
	}
	batches := &fakeBatches{controlled: map[string]bool{"d-ctrl": true}}
	deleter := &fakeDeleter{}
	movements := &fakeMovements{}
	audits := &fakeAudit{}
	svc := NewService(repo, newFakeDrugs(), batches, deleter, movements, audits)
	svc.now = func() time.Time { return now }
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator", Initials: "اپ", BranchID: "branch-central"}

	view, err := svc.Confirm(context.Background(), "r1", actor, "10.0.0.8")
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if view.Status != StatusConfirmed || view.ConfirmedAt == nil || !view.ConfirmedAt.Equal(now) {
		t.Fatalf("confirmed view = %+v", view.Receipt)
	}
	if len(view.CreatedBatchIDs) != 2 || view.CreatedBatchIDs[0] != "b1" || view.CreatedBatchIDs[1] != "b2" {
		t.Fatalf("batch ids = %#v", view.CreatedBatchIDs)
	}
	if view.UpdatedAt != now || view.GrossRial != 93000 {
		t.Fatalf("updated=%s gross=%d", view.UpdatedAt, view.GrossRial)
	}
	if len(deleter.ids) != 0 || len(movements.ids) != 0 {
		t.Fatalf("unexpected deletes batches=%#v movements=%#v", deleter.ids, movements.ids)
	}
	if len(batches.calls) != 2 || len(batches.names) != 2 {
		t.Fatalf("calls=%d names=%d", len(batches.calls), len(batches.names))
	}
	if batches.names[0] != actor.Name || batches.names[1] != actor.Name {
		t.Fatalf("actor names = %#v", batches.names)
	}
	first := batches.calls[0]
	if first.DrugID != "d1" || first.BatchNo != "B-1" || first.Expiry != "2027-01-01" || first.Quantity != 2 || first.UnitLabel != "عدد" {
		t.Fatalf("line1 req = %+v", first)
	}
	if first.LocationLabel != "B-12" || first.BinID != "" || first.InvoiceNo != "F-1" || first.Distributor != "پخش" {
		t.Fatalf("line1 header/location = %+v", first)
	}
	if first.BuyPriceRial != 1500 || first.ConsumerPriceRial != 2000 {
		t.Fatalf("line1 prices = %+v", first)
	}
	second := batches.calls[1]
	if second.DrugID != "d-ctrl" || second.BinID != "bin-s" || second.LocationLabel != "" || second.InvoiceNo != "F-1" || second.BuyPriceRial != 90000 {
		t.Fatalf("line2 req = %+v", second)
	}
	if len(audits.inputs) != 1 {
		t.Fatalf("audits = %d", len(audits.inputs))
	}
	ev := audits.inputs[0]
	if ev.Action != "stock_receipt" || ev.EntityType != "receipt" || ev.EntityID != "r1" {
		t.Fatalf("audit identity = %+v", ev)
	}
	if ev.IP != "10.0.0.8" || ev.Actor.ID != actor.UserID || ev.Actor.Name != actor.Name || ev.Actor.Role != actor.Role || ev.BranchID != actor.BranchID {
		t.Fatalf("audit actor = %+v", ev)
	}
	if !ev.IsControlledSubstance {
		t.Fatal("expected controlled flag")
	}
	ids, _ := ev.After["createdBatchIds"].([]string)
	if len(ids) != 2 || ids[0] != "b1" || ids[1] != "b2" {
		t.Fatalf("audit after = %#v", ev.After)
	}

	stored, err := svc.Get(context.Background(), "r1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if stored.Status != StatusConfirmed || len(stored.CreatedBatchIDs) != 2 {
		t.Fatalf("stored = %+v", stored.Receipt)
	}

	_, err = svc.Confirm(context.Background(), "r1", actor, "10.0.0.8")
	assertConflict(t, err)
	if len(batches.calls) != 2 || len(audits.inputs) != 1 {
		t.Fatalf("second confirm created more work calls=%d audits=%d", len(batches.calls), len(audits.inputs))
	}
}

func TestConfirmGuards(t *testing.T) {
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}
	ctx := context.Background()

	t.Run("missing", func(t *testing.T) {
		svc := NewService(newFakeRepo(), newFakeDrugs(), &fakeBatches{}, &fakeDeleter{}, &fakeMovements{}, &fakeAudit{})
		_, err := svc.Confirm(ctx, "nope", actor, "127.0.0.1")
		var app *errormap.AppError
		if !errors.As(err, &app) || app.Code != "not_found" || app.Message != "رسید یافت نشد" {
			t.Fatalf("got %v", err)
		}
	})

	t.Run("not draft", func(t *testing.T) {
		repo := newFakeRepo()
		repo.items["c1"] = Receipt{ID: "c1", Status: StatusConfirmed, Header: validHeader(), Lines: []Line{{ID: "l1", LocationLabel: "A-1", DrugID: "d1", BatchNo: "B", Expiry: "2027-01-01", Quantity: 1}}}
		batches := &fakeBatches{}
		svc := NewService(repo, newFakeDrugs(), batches, &fakeDeleter{}, &fakeMovements{}, &fakeAudit{})
		_, err := svc.Confirm(ctx, "c1", actor, "127.0.0.1")
		assertConflict(t, err)
		if len(batches.calls) != 0 {
			t.Fatalf("batches called on conflict: %d", len(batches.calls))
		}
	})

	t.Run("empty lines", func(t *testing.T) {
		repo := newFakeRepo()
		repo.items["r1"] = Receipt{ID: "r1", Status: StatusDraft, Header: validHeader(), Lines: []Line{}}
		batches := &fakeBatches{}
		svc := NewService(repo, newFakeDrugs(), batches, &fakeDeleter{}, &fakeMovements{}, &fakeAudit{})
		_, err := svc.Confirm(ctx, "r1", actor, "127.0.0.1")
		assertField(t, err, "lines", "حداقل یک قلم الزامی است")
		if len(batches.calls) != 0 {
			t.Fatal("batches called")
		}
	})

	t.Run("missing shelf", func(t *testing.T) {
		repo := newFakeRepo()
		repo.items["r1"] = Receipt{
			ID: "r1", Status: StatusDraft, Header: validHeader(),
			Lines: []Line{
				{ID: "l1", DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1, LocationLabel: "A-1"},
				{ID: "l2", DrugID: "d2", BatchNo: "B-2", Expiry: "2027-02-01", Quantity: 1, LocationLabel: "  ", BinID: " "},
			},
		}
		batches := &fakeBatches{}
		svc := NewService(repo, newFakeDrugs(), batches, &fakeDeleter{}, &fakeMovements{}, &fakeAudit{})
		_, err := svc.Confirm(ctx, "r1", actor, "127.0.0.1")
		assertField(t, err, "lines[1].locationLabel", "محل قفسه الزامی است")
		if len(batches.calls) != 0 {
			t.Fatal("batches called before validation")
		}
		got, err := svc.Get(ctx, "r1")
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if got.Status != StatusDraft {
			t.Fatalf("status = %s", got.Status)
		}
	})
}

func TestConfirmRollsBackCreatedBatches(t *testing.T) {
	repo := newFakeRepo()
	repo.items["r1"] = Receipt{
		ID: "r1", Status: StatusDraft, Header: validHeader(),
		Lines: []Line{
			{ID: "l1", DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1, LocationLabel: "A-1"},
			{ID: "l2", DrugID: "d2", BatchNo: "B-2", Expiry: "2027-02-01", Quantity: 3, BinID: "bin-2"},
		},
	}
	sentinel := errors.New("core down")
	batches := &fakeBatches{failOn: 2, failErr: sentinel}
	deleter := &fakeDeleter{}
	movements := &fakeMovements{}
	audits := &fakeAudit{}
	svc := NewService(repo, newFakeDrugs(), batches, deleter, movements, audits)

	_, err := svc.Confirm(context.Background(), "r1", requestctx.Actor{Name: "اپراتور"}, "127.0.0.1")
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v", err)
	}
	if len(batches.calls) != 2 {
		t.Fatalf("calls = %d", len(batches.calls))
	}
	if len(deleter.ids) != 1 || deleter.ids[0] != "b1" {
		t.Fatalf("deleted batches = %#v", deleter.ids)
	}
	if len(movements.ids) != 1 || movements.ids[0] != "m1" {
		t.Fatalf("deleted movements = %#v", movements.ids)
	}
	if len(audits.inputs) != 0 {
		t.Fatalf("audit written on failure: %+v", audits.inputs)
	}
	got, err := svc.Get(context.Background(), "r1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusDraft || got.ConfirmedAt != nil || len(got.CreatedBatchIDs) != 0 {
		t.Fatalf("receipt changed: %+v", got.Receipt)
	}
}

func TestConfirmRollsBackWhenAuditFails(t *testing.T) {
	repo := newFakeRepo()
	repo.items["r1"] = Receipt{
		ID: "r1", Status: StatusDraft, Header: validHeader(),
		Lines: []Line{{ID: "l1", DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1, LocationLabel: "A-1"}},
	}
	sentinel := errors.New("audit down")
	batches := &fakeBatches{}
	deleter := &fakeDeleter{}
	movements := &fakeMovements{}
	audits := &fakeAudit{err: sentinel}
	svc := NewService(repo, newFakeDrugs(), batches, deleter, movements, audits)

	_, err := svc.Confirm(context.Background(), "r1", requestctx.Actor{Name: "اپراتور"}, "127.0.0.1")
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v", err)
	}
	if len(deleter.ids) != 1 || deleter.ids[0] != "b1" {
		t.Fatalf("deleted batches = %#v", deleter.ids)
	}
	if len(movements.ids) != 1 || movements.ids[0] != "m1" {
		t.Fatalf("deleted movements = %#v", movements.ids)
	}
	got, err := svc.Get(context.Background(), "r1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusDraft || got.ConfirmedAt != nil {
		t.Fatalf("receipt changed: %+v", got.Receipt)
	}
}

func TestConfirmSecondClaimConflicts(t *testing.T) {
	repo := newFakeRepo()
	repo.maxClaims = 1
	repo.items["r1"] = Receipt{
		ID: "r1", Status: StatusDraft, Header: validHeader(),
		Lines: []Line{{ID: "l1", DrugID: "d1", BatchNo: "B-1", Expiry: "2027-01-01", Quantity: 1, LocationLabel: "A-1"}},
	}
	batches := &fakeBatches{}
	audits := &fakeAudit{}
	svc := NewService(repo, newFakeDrugs(), batches, &fakeDeleter{}, &fakeMovements{}, audits)
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}

	if _, err := svc.Confirm(context.Background(), "r1", actor, "127.0.0.1"); err != nil {
		t.Fatalf("first confirm: %v", err)
	}
	if len(batches.calls) != 1 || len(audits.inputs) != 1 {
		t.Fatalf("first confirm calls=%d audits=%d", len(batches.calls), len(audits.inputs))
	}

	// Concurrent loser still sees a draft, then loses ClaimDraft.
	lost := repo.items["r1"]
	lost.Status = StatusDraft
	lost.ConfirmedAt = nil
	lost.CreatedBatchIDs = nil
	repo.items["r1"] = lost

	_, err := svc.Confirm(context.Background(), "r1", actor, "127.0.0.1")
	assertConflict(t, err)
	if repo.claims != 2 {
		t.Fatalf("claims = %d", repo.claims)
	}
	if len(batches.calls) != 1 || len(audits.inputs) != 1 {
		t.Fatalf("second confirm created work calls=%d audits=%d", len(batches.calls), len(audits.inputs))
	}
	got, err := svc.Get(context.Background(), "r1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusDraft || got.ConfirmedAt != nil || len(got.CreatedBatchIDs) != 0 {
		t.Fatalf("lost claim mutated receipt: %+v", got.Receipt)
	}
}

type fakeBatches struct {
	calls      []expiry.CreateRequest
	names      []string
	failOn     int
	failErr    error
	controlled map[string]bool
}

func (f *fakeBatches) CreateBatchCore(_ context.Context, req expiry.CreateRequest, actorName string) (shelf.StockBatch, string, error) {
	f.calls = append(f.calls, req)
	f.names = append(f.names, actorName)
	if f.failOn > 0 && len(f.calls) == f.failOn {
		if f.failErr != nil {
			return shelf.StockBatch{}, "", f.failErr
		}
		return shelf.StockBatch{}, "", errors.New("batch failed")
	}
	n := strconv.Itoa(len(f.calls))
	return shelf.StockBatch{ID: "b" + n, DrugID: req.DrugID, BatchNo: req.BatchNo, IsControlled: f.controlled[req.DrugID]}, "m" + n, nil
}

type fakeDeleter struct {
	ids []string
}

func (f *fakeDeleter) DeleteBatch(_ context.Context, id string) error {
	f.ids = append(f.ids, id)
	return nil
}

type fakeMovements struct {
	ids []string
}

func (f *fakeMovements) Delete(_ context.Context, id string) error {
	f.ids = append(f.ids, id)
	return nil
}

type fakeAudit struct {
	inputs []audit.AppendInput
	err    error
}

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	f.inputs = append(f.inputs, in)
	if f.err != nil {
		return audit.Event{}, f.err
	}
	return audit.Event{Action: in.Action, EntityID: in.EntityID}, nil
}
