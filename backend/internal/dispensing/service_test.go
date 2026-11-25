package dispensing

import (
	"context"
	"errors"
	"sort"
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

func TestCreate_DefaultsTechnicalFeeWhenFeesOmitted(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "dispenser"}

	view, err := svc.Create(context.Background(), Patient{NameFa: "  بیمار نمونه  "}, nil, actor)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if view.ID == "" || view.Status != StatusDraft {
		t.Fatalf("order = %+v", view.Order)
	}
	if view.Patient.NameFa != "بیمار نمونه" {
		t.Fatalf("patient = %+v", view.Patient)
	}
	if view.Fees.TechnicalFee != 50000 || view.Fees.InsuranceCover != 0 {
		t.Fatalf("fees = %+v", view.Fees)
	}
	if view.Lines == nil || len(view.Lines) != 0 {
		t.Fatalf("lines = %#v", view.Lines)
	}
	if view.CreatedBy.UserID != actor.UserID || view.CreatedBy.Name != actor.Name || view.CreatedBy.Role != actor.Role {
		t.Fatalf("createdBy = %+v", view.CreatedBy)
	}
	if view.GoodsTotal != 0 || view.PatientPayable != 50000 || view.LineCount != 0 {
		t.Fatalf("totals goods=%d payable=%d lines=%d", view.GoodsTotal, view.PatientPayable, view.LineCount)
	}
	if view.CreatedAt.IsZero() || view.UpdatedAt.IsZero() {
		t.Fatal("expected timestamps")
	}

	got, err := svc.Get(context.Background(), view.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Fees.TechnicalFee != 50000 || got.Status != StatusDraft {
		t.Fatalf("persisted = %+v", got.Order)
	}
}

func TestCreate_KeepsExplicitZeroFee(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	view, err := svc.Create(context.Background(), Patient{}, &Fees{TechnicalFee: 0, InsuranceCover: 0}, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if view.Fees.TechnicalFee != 0 || view.PatientPayable != 0 {
		t.Fatalf("fees = %+v payable=%d", view.Fees, view.PatientPayable)
	}
}

func TestCreate_RejectsNegativeFees(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	_, err := svc.Create(context.Background(), Patient{}, &Fees{TechnicalFee: -1}, requestctx.Actor{UserID: "u1"})
	assertField(t, err, "technicalFee", "مبلغ نامعتبر است")
}

func TestFEFOPreview_PicksSoonerBatch(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین"}
	stock := newFakeShelf()
	stock.byDrug["d1"] = []shelf.StockBatch{
		activeBatch("later", "d1", "AX-L", "2027-06-01", 5, 1000),
		activeBatch("soon", "d1", "AX-S", "2026-12-01", 8, 1000),
	}
	svc := NewService(newFakeOrders(), drugs, stock, nil, nil)

	got, err := svc.FEFOPreview(context.Background(), " d1 ")
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if got.ID != "soon" || got.BatchNo != "AX-S" {
		t.Fatalf("batch = %+v", got)
	}
}

func TestFEFOPreview_RequiresDrugAndStock(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1"}
	svc := NewService(newFakeOrders(), drugs, newFakeShelf(), nil, nil)

	_, err := svc.FEFOPreview(context.Background(), "  ")
	assertField(t, err, "drugId", "شناسه دارو الزامی است")

	_, err = svc.FEFOPreview(context.Background(), "missing")
	assertNotFound(t, err, "دارو یافت نشد")

	_, err = svc.FEFOPreview(context.Background(), "d1")
	assertNotFound(t, err, "موجودی قابل استفاده برای این دارو یافت نشد")
}

func TestGetMissing(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	_, err := svc.Get(context.Background(), "missing")
	assertNotFound(t, err, "حواله یافت نشد")
}

func TestList_FiltersStatusAndIncludesTotals(t *testing.T) {
	orders := newFakeOrders()
	orders.items["c1"] = Order{
		ID: "c1", Status: StatusConfirmed, Lines: []Line{},
		Fees: Fees{TechnicalFee: 50000}, UpdatedAt: time.Now().UTC(),
	}
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین", UnitLabel: "عدد"}
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{
		activeBatch("b1", "d1", "AX-1", "2026-12-01", 4, 45000),
	}
	svc := NewService(orders, drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{NameFa: "بیمار"}, nil, requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "dispenser"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 2}); err != nil {
		t.Fatalf("add: %v", err)
	}

	res, err := svc.List(context.Background(), StatusDraft, pagination.Params{Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if res.Total != 1 || len(res.Items) != 1 || res.Items[0].ID != created.ID {
		t.Fatalf("list = %+v", res)
	}
	item := res.Items[0]
	if item.GoodsTotal != 90000 || item.PatientPayable != 140000 || item.LineCount != 1 {
		t.Fatalf("list totals goods=%d payable=%d lines=%d", item.GoodsTotal, item.PatientPayable, item.LineCount)
	}
}

func TestPatch_PatientAndFees(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	created, err := svc.Create(context.Background(), Patient{NameFa: "قدیم"}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	name := "  علی رضایی "
	nid := "001"
	cover := int64(80000)
	patched, err := svc.Patch(context.Background(), created.ID, PatientFeesPatch{
		Patient: &PatientPatch{NameFa: &name, NationalID: &nid},
		Fees:    &FeesPatch{InsuranceCover: &cover},
	})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	if patched.Patient.NameFa != "علی رضایی" || patched.Patient.NationalID != "001" {
		t.Fatalf("patient = %+v", patched.Patient)
	}
	if patched.Fees.TechnicalFee != 50000 || patched.Fees.InsuranceCover != 80000 {
		t.Fatalf("fees = %+v", patched.Fees)
	}
	if patched.PatientPayable != 0 {
		t.Fatalf("payable = %d", patched.PatientPayable)
	}
}

func TestAddLine_PicksSoonerExpiringActiveBatch(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین", Manufacturer: "عبیدی", UnitLabel: "عدد"}
	shelfStore := newFakeShelf()
	later := activeBatch("later", "d1", "AX-LATE", "2027-06-01", 10, 1000)
	sooner := activeBatch("soon", "d1", "AX-SOON", "2026-12-01", 4, 45000)
	sooner.NameEn = "Amoxicillin"
	sooner.LocationLabel = "A-03-2-04"
	expired := activeBatch("expired", "d1", "AX-OLD", "2020-01-01", 9, 1)
	quarantine := activeBatch("quar", "d1", "AX-Q", "2026-01-01", 9, 1)
	quarantine.Status = "quarantine"
	shelfStore.byDrug["d1"] = []shelf.StockBatch{later, expired, quarantine, sooner}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)

	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	view, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 2})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(view.Lines) != 1 {
		t.Fatalf("lines = %d", len(view.Lines))
	}
	line := view.Lines[0]
	if line.ID == "" || line.BatchID != "soon" || line.BatchNo != "AX-SOON" || line.Expiry != "2026-12-01" {
		t.Fatalf("picked = %+v", line)
	}
	if line.Allocation != AllocationFEFO || line.DrugID != "d1" || line.NameFa != "آموکسی‌سیلین" || line.NameEn != "Amoxicillin" {
		t.Fatalf("identity = %+v", line)
	}
	if line.Manufacturer != "عبیدی" || line.UnitLabel != "عدد" || line.LocationLabel != "A-03-2-04" {
		t.Fatalf("snapshot = %+v", line)
	}
	if line.Quantity != 2 || line.ConsumerPrice != 45000 {
		t.Fatalf("qty/price = %+v", line)
	}
	if line.IsColdChain || line.IsControlled {
		t.Fatalf("flags cold=%v controlled=%v", line.IsColdChain, line.IsControlled)
	}
	if view.GoodsTotal != 90000 || view.PatientPayable != 140000 || view.LineCount != 1 {
		t.Fatalf("totals goods=%d payable=%d count=%d", view.GoodsTotal, view.PatientPayable, view.LineCount)
	}
}

func TestAddLine_PrefersDispensingZone(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین"}
	shelfStore := newFakeShelf()
	main := activeBatch("main", "d1", "M", "2026-12-01", 5, 100)
	main.Zone = "A"
	pos := activeBatch("pos", "d1", "P", "2026-12-01", 5, 100)
	pos.Zone = "C"
	shelfStore.byDrug["d1"] = []shelf.StockBatch{main, pos}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	view, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 1})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if view.Lines[0].BatchID != "pos" || view.Lines[0].Allocation != AllocationFEFO {
		t.Fatalf("picked = %+v", view.Lines[0])
	}
}

func TestAddLine_DefaultsQuantityAndFlagsColdControlled(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "انسولین", IsControlled: false}
	shelfStore := newFakeShelf()
	batch := activeBatch("cold", "d1", "IN-1", "2026-12-15", 3, 890000)
	batch.Zone = "R"
	batch.IsControlled = true
	batch.BinID = "bin-r"
	batch.LocationLabel = ""
	shelfStore.byDrug["d1"] = []shelf.StockBatch{batch}
	shelfStore.bins["bin-r"] = &shelf.Bin{ID: "bin-r", Address: "R-01-1-01"}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, &Fees{TechnicalFee: 50000, InsuranceCover: 10000}, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	view, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1"})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	line := view.Lines[0]
	if line.Quantity != 1 || line.ConsumerPrice != 890000 || line.LocationLabel != "R-01-1-01" || line.BinID != "bin-r" {
		t.Fatalf("line = %+v", line)
	}
	if !line.IsColdChain || !line.IsControlled {
		t.Fatalf("flags cold=%v controlled=%v", line.IsColdChain, line.IsControlled)
	}
	if view.GoodsTotal != 890000 || view.PatientPayable != 930000 || view.ColdCount != 1 || view.ControlledCount != 1 {
		t.Fatalf("totals goods=%d payable=%d cold=%d controlled=%d", view.GoodsTotal, view.PatientPayable, view.ColdCount, view.ControlledCount)
	}
	if len(shelfStore.binGets) != 1 || shelfStore.binGets[0] != "bin-r" {
		t.Fatalf("bin gets = %#v", shelfStore.binGets)
	}
}

func TestAddLine_ControlledFromDrug(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "مورفین", IsControlled: true}
	shelfStore := newFakeShelf()
	batch := activeBatch("b1", "d1", "MF-1", "2027-01-01", 2, 1000)
	batch.StorageNote = "یخچال"
	shelfStore.byDrug["d1"] = []shelf.StockBatch{batch}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	view, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 1})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if !view.Lines[0].IsControlled || !view.Lines[0].IsColdChain {
		t.Fatalf("flags = %+v", view.Lines[0])
	}
}

func TestAddLine_RejectsWhenNoUsableStock(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین"}
	shelfStore := newFakeShelf()
	empty := activeBatch("zero", "d1", "Z", "2026-12-01", 0, 100)
	shelfStore.byDrug["d1"] = []shelf.StockBatch{empty}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 1})
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "validation_error" {
		t.Fatalf("expected validation, got %v", err)
	}
	if app.Message != "موجودی قابل استفاده برای این دارو یافت نشد" {
		t.Fatalf("message = %q", app.Message)
	}
	got, err := svc.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(got.Lines) != 0 {
		t.Fatalf("line persisted: %+v", got.Lines)
	}
}

func TestAddLine_RequiresDrugOrBarcode(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, LineInput{Quantity: 1})
	assertField(t, err, "drugId", "شناسه دارو یا بارکد الزامی است")
}

func TestAddLine_RejectsNegativeQuantity(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین"}
	svc := NewService(newFakeOrders(), drugs, newFakeShelf(), nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: -2})
	assertField(t, err, "quantity", "تعداد باید بزرگ‌تر از صفر باشد")
}

func TestAddLine_ResolvesGTIN(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین", GTIN: "06261234567890"}
	drugs.byGTIN["06261234567890"] = drugs.items["d1"]
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{activeBatch("b1", "d1", "AX-1", "2026-12-01", 5, 45000)}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	view, err := svc.AddLine(context.Background(), created.ID, LineInput{GTIN: " 06261234567890 ", Quantity: 1})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(drugs.gtinLookups) != 1 || drugs.gtinLookups[0] != "06261234567890" {
		t.Fatalf("lookups = %#v", drugs.gtinLookups)
	}
	if view.Lines[0].DrugID != "d1" || view.Lines[0].BatchID != "b1" {
		t.Fatalf("line = %+v", view.Lines[0])
	}
}

func TestAddLine_ResolvesBarcodeAsGTIN(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین", GTIN: "06260000000001"}
	drugs.byGTIN["06260000000001"] = drugs.items["d1"]
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{activeBatch("b1", "d1", "AX-1", "2026-12-01", 5, 100)}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	view, err := svc.AddLine(context.Background(), created.ID, LineInput{Barcode: "06260000000001"})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(drugs.gtinLookups) != 1 || drugs.gtinLookups[0] != "06260000000001" {
		t.Fatalf("lookups = %#v", drugs.gtinLookups)
	}
	if view.Lines[0].DrugID != "d1" || view.Lines[0].Quantity != 1 {
		t.Fatalf("line = %+v", view.Lines[0])
	}
}

func TestAddLine_DrugIDSkipsGTINLookup(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین", GTIN: "06260000000001"}
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{activeBatch("b1", "d1", "AX-1", "2026-12-01", 5, 100)}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", GTIN: "06260000000001"}); err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(drugs.gtinLookups) != 0 {
		t.Fatalf("lookups = %#v", drugs.gtinLookups)
	}
}

func TestAddLine_MissingDrug(t *testing.T) {
	svc := NewService(newFakeOrders(), newFakeDrugs(), newFakeShelf(), nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "missing"})
	assertNotFound(t, err, "دارو یافت نشد")
	_, err = svc.AddLine(context.Background(), created.ID, LineInput{GTIN: "000"})
	assertNotFound(t, err, "دارو یافت نشد")
}

func TestPatchLine_ManualRequiresReason(t *testing.T) {
	svc, created := draftWithFEFOLine(t)
	batchID := "manual-batch"
	_, err := svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{BatchID: &batchID})
	assertField(t, err, "manualReason", "دلیل انتخاب دستی الزامی است")

	blank := "   "
	_, err = svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{BatchID: &batchID, ManualReason: &blank})
	assertField(t, err, "manualReason", "دلیل انتخاب دستی الزامی است")

	got, err := svc.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Lines[0].Allocation != AllocationFEFO || got.Lines[0].BatchID == batchID {
		t.Fatalf("manual applied without reason: %+v", got.Lines[0])
	}
}

func TestPatchLine_ManualSnapshotsBatch(t *testing.T) {
	svc, created := draftWithFEFOLine(t)
	batchID := "manual-batch"
	reason := "  درخواست پزشک "
	view, err := svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{
		BatchID: &batchID, ManualReason: &reason,
	})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	line := view.Lines[0]
	if line.Allocation != AllocationManual || line.ManualReason != "درخواست پزشک" || line.BatchID != "manual-batch" {
		t.Fatalf("line = %+v", line)
	}
	if line.BatchNo != "MN-9" || line.Expiry != "2027-08-01" || line.ConsumerPrice != 77000 || line.LocationLabel != "B-02" {
		t.Fatalf("snapshot = %+v", line)
	}
}

func TestPatchLine_ManualRejectsOtherDrugAndUnusable(t *testing.T) {
	svc, created := draftWithFEFOLine(t)
	other := "other-drug"
	reason := "دلیل"
	_, err := svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{BatchID: &other, ManualReason: &reason})
	assertField(t, err, "batchId", "سری ساخت متعلق به این دارو نیست")

	dead := "depleted"
	_, err = svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{BatchID: &dead, ManualReason: &reason})
	assertField(t, err, "batchId", "سری ساخت قابل خروج نیست")

	missing := "nope"
	_, err = svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{BatchID: &missing, ManualReason: &reason})
	assertNotFound(t, err, "سری ساخت یافت نشد")
}

func TestPatchLine_IncompleteControlledAllowedOnDraft(t *testing.T) {
	// Confirm (Task 4) must reject this line. Draft patch persists the incomplete block.
	svc, created := draftWithFEFOLine(t)
	controlled := Controlled{
		PhysicianName: "دکتر",
		TechnicalAck:  false,
	}
	view, err := svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{Controlled: &controlled})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	got := view.Lines[0].Controlled
	if got == nil || got.PhysicianName != "دکتر" || got.TechnicalAck || got.RecipientNationalID != "" || got.ERxTrackingID != "" {
		t.Fatalf("controlled = %+v", got)
	}
	if view.Status != StatusDraft {
		t.Fatalf("status = %s", view.Status)
	}
}

func TestPatchLine_Quantity(t *testing.T) {
	svc, created := draftWithFEFOLine(t)
	qty := 3
	view, err := svc.PatchLine(context.Background(), created.ID, created.Lines[0].ID, LinePatch{Quantity: &qty})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	if view.Lines[0].Quantity != 3 || view.Lines[0].Allocation != AllocationFEFO || view.GoodsTotal != 3*45000 {
		t.Fatalf("line = %+v goods=%d", view.Lines[0], view.GoodsTotal)
	}
	bad := 0
	_, err = svc.PatchLine(context.Background(), created.ID, view.Lines[0].ID, LinePatch{Quantity: &bad})
	assertField(t, err, "quantity", "تعداد باید بزرگ‌تر از صفر باشد")
}

func TestDeleteLineAndClearLines(t *testing.T) {
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین"}
	drugs.items["d2"] = &drug.Drug{ID: "d2", NameFa: "ایبوپروفن"}
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{activeBatch("b1", "d1", "A", "2026-12-01", 5, 1000)}
	shelfStore.byDrug["d2"] = []shelf.StockBatch{activeBatch("b2", "d2", "B", "2026-12-01", 5, 2000)}
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	first, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 1})
	if err != nil {
		t.Fatalf("add1: %v", err)
	}
	second, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d2", Quantity: 1})
	if err != nil {
		t.Fatalf("add2: %v", err)
	}
	if second.LineCount != 2 || second.GoodsTotal != 3000 {
		t.Fatalf("after two lines count=%d goods=%d", second.LineCount, second.GoodsTotal)
	}

	deleted, err := svc.DeleteLine(context.Background(), created.ID, first.Lines[0].ID)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if deleted.LineCount != 1 || deleted.Lines[0].DrugID != "d2" || deleted.GoodsTotal != 2000 {
		t.Fatalf("after delete = %+v", deleted.Lines)
	}
	_, err = svc.DeleteLine(context.Background(), created.ID, "missing")
	assertNotFound(t, err, "قلم حواله یافت نشد")

	cleared, err := svc.ClearLines(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("clear: %v", err)
	}
	if cleared.LineCount != 0 || len(cleared.Lines) != 0 || cleared.GoodsTotal != 0 || cleared.PatientPayable != 50000 {
		t.Fatalf("cleared goods=%d payable=%d lines=%#v", cleared.GoodsTotal, cleared.PatientPayable, cleared.Lines)
	}
}

func TestMutationsConflictWhenNotDraft(t *testing.T) {
	orders := newFakeOrders()
	orders.items["c1"] = Order{
		ID: "c1", Status: StatusConfirmed,
		Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "آموکسی‌سیلین", Quantity: 1,
			ConsumerPrice: 1000, BatchID: "b1", Allocation: AllocationFEFO,
		}},
		Fees:      Fees{TechnicalFee: 50000},
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین"}
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{activeBatch("b2", "d1", "N", "2026-12-01", 4, 1000)}
	svc := NewService(orders, drugs, shelfStore, nil, nil)
	ctx := context.Background()

	_, err := svc.AddLine(ctx, "c1", LineInput{DrugID: "d1"})
	assertConflict(t, err)
	name := "دیگر"
	_, err = svc.Patch(ctx, "c1", PatientFeesPatch{Patient: &PatientPatch{NameFa: &name}})
	assertConflict(t, err)
	qty := 4
	_, err = svc.PatchLine(ctx, "c1", "l1", LinePatch{Quantity: &qty})
	assertConflict(t, err)
	_, err = svc.DeleteLine(ctx, "c1", "l1")
	assertConflict(t, err)
	_, err = svc.ClearLines(ctx, "c1")
	assertConflict(t, err)

	got, err := svc.Get(ctx, "c1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusConfirmed || got.Patient.NameFa != "بیمار" || len(got.Lines) != 1 || got.Lines[0].Quantity != 1 {
		t.Fatalf("confirmed mutated: %+v", got.Order)
	}
}

func TestConfirm_DeductsAndAudits(t *testing.T) {
	orders := newFakeOrders()
	orders.items["order-12345"] = Order{
		ID:      "order-12345",
		Status:  StatusDraft,
		Patient: Patient{NameFa: "علی رضایی"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "آموکسی‌سیلین", Quantity: 2,
			BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO,
		}},
		Fees:      Fees{TechnicalFee: 50000},
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 20, 45000)
	movements := &fakeCardex{}
	audits := &fakeAudit{}
	svc := NewService(orders, newFakeDrugs(), stock, movements, audits)
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "dispenser", Initials: "اپ", BranchID: "br1"}

	view, err := svc.Confirm(context.Background(), "order-12345", actor)
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if view.Status != StatusConfirmed || view.OrderNo != "OUT-12345" || view.ConfirmedAt == nil {
		t.Fatalf("confirmed = %+v", view.Order)
	}
	gotBatch, err := stock.GetBatch(context.Background(), "b1")
	if err != nil || gotBatch == nil || gotBatch.Quantity != 18 || gotBatch.Status != "active" {
		t.Fatalf("batch = %+v err=%v", gotBatch, err)
	}
	if len(movements.inputs) != 1 {
		t.Fatalf("cardex = %+v", movements.inputs)
	}
	move := movements.inputs[0]
	if move.DrugID != "d1" || move.Type != "dispensing" || move.BatchNo != "AX-1" || move.QtyOut != 2 || move.QtyIn != 0 || move.ActorName != "اپراتور" {
		t.Fatalf("movement = %+v", move)
	}
	if len(audits.inputs) != 1 {
		t.Fatalf("audits = %+v", audits.inputs)
	}
	ev := audits.inputs[0]
	if ev.Action != "dispensing" || ev.EntityType != "dispense" || ev.EntityID != "order-12345" || ev.EntityLabel != "OUT-12345" {
		t.Fatalf("audit = %+v", ev)
	}
	if ev.IsControlledSubstance || ev.Actor.ID != actor.UserID || ev.Actor.Name != actor.Name || ev.Actor.Role != actor.Role || ev.Actor.Initials != actor.Initials || ev.BranchID != actor.BranchID {
		t.Fatalf("audit actor = %+v", ev)
	}
	persisted, err := svc.Get(context.Background(), "order-12345")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if persisted.Status != StatusConfirmed || persisted.OrderNo != "OUT-12345" || persisted.ConfirmedAt == nil {
		t.Fatalf("persisted = %+v", persisted.Order)
	}
}

func TestConfirm_ControlledRequiresAck(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 1, BatchID: "b1", BatchNo: "MF-1",
			Allocation: AllocationFEFO, IsControlled: true,
			Controlled: &Controlled{
				PhysicianName: "دکتر", RecipientNationalID: "001", ERxTrackingID: "RX1", TechnicalAck: false,
			},
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "MF-1", "2027-01-01", 5, 1000)
	movements := &fakeCardex{}
	audits := &fakeAudit{}
	svc := NewService(orders, newFakeDrugs(), stock, movements, audits)

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{UserID: "u1", Name: "اپراتور"})
	assertField(t, err, "lines[0].controlled.technicalAck", "تأیید مسئول فنی الزامی است")
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 5 || len(stock.qtyUpdates) != 0 || len(movements.inputs) != 0 || len(audits.inputs) != 0 {
		t.Fatalf("mutated qty=%d updates=%v cardex=%d audit=%d", got.Quantity, stock.qtyUpdates, len(movements.inputs), len(audits.inputs))
	}
	persisted, err := svc.Get(context.Background(), "o1")
	if err != nil || persisted.Status != StatusDraft || persisted.OrderNo != "" {
		t.Fatalf("order = %+v err=%v", persisted.Order, err)
	}
}

func TestConfirm_Shortage(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 2, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO,
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 1, 1000)
	movements := &fakeCardex{}
	audits := &fakeAudit{}
	svc := NewService(orders, newFakeDrugs(), stock, movements, audits)

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	assertField(t, err, "lines[0].quantity", "موجودی سری ساخت کافی نیست")
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 1 || len(stock.qtyUpdates) != 0 || len(movements.inputs) != 0 || len(audits.inputs) != 0 {
		t.Fatalf("mutated qty=%d updates=%v", got.Quantity, stock.qtyUpdates)
	}
	persisted, err := svc.Get(context.Background(), "o1")
	if err != nil || persisted.Status != StatusDraft {
		t.Fatalf("status err=%v order=%+v", err, persisted.Order)
	}
}

func TestConfirm_ConflictWhenConfirmed(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusConfirmed, OrderNo: "OUT-EXIST",
		Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 2, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO,
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 20, 1000)
	movements := &fakeCardex{}
	audits := &fakeAudit{}
	svc := NewService(orders, newFakeDrugs(), stock, movements, audits)

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "conflict" || app.Message != "فقط پیش‌نویس قابل تایید است" {
		t.Fatalf("expected conflict, got %v", err)
	}
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 20 || len(movements.inputs) != 0 || len(audits.inputs) != 0 {
		t.Fatalf("mutated on conflict qty=%d", got.Quantity)
	}
	persisted, err := svc.Get(context.Background(), "o1")
	if err != nil || persisted.Status != StatusConfirmed || persisted.OrderNo != "OUT-EXIST" {
		t.Fatalf("order = %+v err=%v", persisted.Order, err)
	}
}

func TestConfirm_RollbackLeavesDraft(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{
			{ID: "l1", DrugID: "d1", Quantity: 2, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO},
			{ID: "l2", DrugID: "d2", Quantity: 3, BatchID: "b2", BatchNo: "IB-1", Allocation: AllocationFEFO},
		},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 20, 1000)
	stock.batches["b2"] = activeBatch("b2", "d2", "IB-1", "2026-12-01", 10, 2000)
	sentinel := errors.New("cardex down")
	movements := &fakeCardex{failOn: 2, err: sentinel}
	audits := &fakeAudit{}
	svc := NewService(orders, newFakeDrugs(), stock, movements, audits)

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v", err)
	}
	b1, _ := stock.GetBatch(context.Background(), "b1")
	b2, _ := stock.GetBatch(context.Background(), "b2")
	if b1.Quantity != 20 || b2.Quantity != 10 {
		t.Fatalf("qty b1=%d b2=%d updates=%v", b1.Quantity, b2.Quantity, stock.qtyUpdates)
	}
	if len(audits.inputs) != 0 {
		t.Fatalf("audit on rollback: %+v", audits.inputs)
	}
	persisted, err := svc.Get(context.Background(), "o1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if persisted.Status != StatusDraft || persisted.ConfirmedAt != nil || persisted.OrderNo != "" {
		t.Fatalf("order = %+v", persisted.Order)
	}
}

func TestConfirm_RollbackReactivatesZeroedBatch(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{
			{ID: "l1", DrugID: "d1", Quantity: 2, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO},
			{ID: "l2", DrugID: "d2", Quantity: 1, BatchID: "b2", BatchNo: "IB-1", Allocation: AllocationFEFO},
		},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 2, 1000)
	stock.batches["b2"] = activeBatch("b2", "d2", "IB-1", "2026-12-01", 5, 1000)
	sentinel := errors.New("cardex down")
	svc := NewService(orders, newFakeDrugs(), stock, &fakeCardex{failOn: 2, err: sentinel}, &fakeAudit{})

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v", err)
	}
	b1, _ := stock.GetBatch(context.Background(), "b1")
	b2, _ := stock.GetBatch(context.Background(), "b2")
	if b1.Quantity != 2 || b1.Status != "active" || b2.Quantity != 5 || b2.Status != "active" {
		t.Fatalf("b1=%+v b2=%+v", b1, b2)
	}
	persisted, err := svc.Get(context.Background(), "o1")
	if err != nil || persisted.Status != StatusDraft {
		t.Fatalf("order = %+v err=%v", persisted.Order, err)
	}
}

func TestConfirm_RequiresPatientName(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "   "},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 1, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO,
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 5, 1000)
	svc := NewService(orders, newFakeDrugs(), stock, &fakeCardex{}, &fakeAudit{})

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	assertField(t, err, "nameFa", "نام بیمار الزامی است")
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 5 || len(stock.qtyUpdates) != 0 {
		t.Fatalf("mutated qty=%d", got.Quantity)
	}
}

func TestConfirm_RequiresLine(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"}, Lines: []Line{}}
	svc := NewService(orders, newFakeDrugs(), newFakeShelf(), &fakeCardex{}, &fakeAudit{})

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	assertField(t, err, "lines", "حداقل یک قلم الزامی است")
}

func TestConfirm_ManualRequiresReason(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 1, BatchID: "b1", BatchNo: "AX-1",
			Allocation: AllocationManual, ManualReason: "  ",
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 5, 1000)
	svc := NewService(orders, newFakeDrugs(), stock, &fakeCardex{}, &fakeAudit{})

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	assertField(t, err, "lines[0].manualReason", "دلیل انتخاب دستی الزامی است")
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 5 {
		t.Fatalf("qty = %d", got.Quantity)
	}
}

func TestConfirm_ControlledDispenseType(t *testing.T) {
	orders := newFakeOrders()
	orders.items["disp-abcde"] = Order{
		ID: "disp-abcde", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{
			{ID: "l1", DrugID: "d1", Quantity: 1, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO},
			{
				ID: "l2", DrugID: "d2", Quantity: 1, BatchID: "b2", BatchNo: "MF-1",
				Allocation: AllocationManual, ManualReason: "درخواست پزشک", IsControlled: true,
				Controlled: &Controlled{
					PhysicianName: "دکتر", RecipientNationalID: "001", ERxTrackingID: "RX1", TechnicalAck: true,
				},
			},
		},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 20, 1000)
	stock.batches["b2"] = activeBatch("b2", "d2", "MF-1", "2027-01-01", 8, 2000)
	movements := &fakeCardex{}
	audits := &fakeAudit{}
	svc := NewService(orders, newFakeDrugs(), stock, movements, audits)

	view, err := svc.Confirm(context.Background(), "disp-abcde", requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "dispenser"})
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if view.Status != StatusConfirmed || view.OrderNo != "OUT-abcde" {
		t.Fatalf("order = %+v", view.Order)
	}
	b1, _ := stock.GetBatch(context.Background(), "b1")
	b2, _ := stock.GetBatch(context.Background(), "b2")
	if b1.Quantity != 19 || b2.Quantity != 7 {
		t.Fatalf("qty b1=%d b2=%d", b1.Quantity, b2.Quantity)
	}
	if len(movements.inputs) != 2 || movements.inputs[0].Type != "dispensing" || movements.inputs[0].QtyOut != 1 || movements.inputs[1].Type != "controlled_dispense" || movements.inputs[1].QtyOut != 1 {
		t.Fatalf("cardex = %+v", movements.inputs)
	}
	if len(audits.inputs) != 1 || audits.inputs[0].Action != "controlled_dispense" || audits.inputs[0].EntityType != "dispense" || !audits.inputs[0].IsControlledSubstance {
		t.Fatalf("audit = %+v", audits.inputs)
	}
}

func TestConfirm_DepletesBatchAtZero(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 2, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO,
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 2, 1000)
	svc := NewService(orders, newFakeDrugs(), stock, &fakeCardex{}, &fakeAudit{})

	if _, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"}); err != nil {
		t.Fatalf("confirm: %v", err)
	}
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 0 || got.Status != "depleted" {
		t.Fatalf("batch = %+v", got)
	}
}

func TestConfirm_RollbackWhenAuditFails(t *testing.T) {
	orders := newFakeOrders()
	orders.items["o1"] = Order{
		ID: "o1", Status: StatusDraft, Patient: Patient{NameFa: "بیمار"},
		Lines: []Line{{
			ID: "l1", DrugID: "d1", Quantity: 2, BatchID: "b1", BatchNo: "AX-1", Allocation: AllocationFEFO,
		}},
	}
	stock := newFakeShelf()
	stock.batches["b1"] = activeBatch("b1", "d1", "AX-1", "2026-12-01", 20, 1000)
	sentinel := errors.New("audit down")
	svc := NewService(orders, newFakeDrugs(), stock, &fakeCardex{}, &fakeAudit{err: sentinel})

	_, err := svc.Confirm(context.Background(), "o1", requestctx.Actor{Name: "اپراتور"})
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v", err)
	}
	got, _ := stock.GetBatch(context.Background(), "b1")
	if got.Quantity != 20 || got.Status != "active" {
		t.Fatalf("batch = %+v updates=%v", got, stock.qtyUpdates)
	}
	persisted, err := svc.Get(context.Background(), "o1")
	if err != nil || persisted.Status != StatusDraft || persisted.ConfirmedAt != nil || persisted.OrderNo != "" {
		t.Fatalf("order = %+v err=%v", persisted.Order, err)
	}
}

func draftWithFEFOLine(t *testing.T) (*Service, View) {
	t.Helper()
	drugs := newFakeDrugs()
	drugs.items["d1"] = &drug.Drug{ID: "d1", NameFa: "آموکسی‌سیلین", UnitLabel: "عدد"}
	shelfStore := newFakeShelf()
	shelfStore.byDrug["d1"] = []shelf.StockBatch{activeBatch("soon", "d1", "AX-SOON", "2026-12-01", 8, 45000)}
	manual := activeBatch("manual-batch", "d1", "MN-9", "2027-08-01", 6, 77000)
	manual.LocationLabel = "B-02"
	shelfStore.batches["manual-batch"] = manual
	other := activeBatch("other-drug", "d2", "OT", "2026-12-01", 3, 10)
	shelfStore.batches["other-drug"] = other
	dead := activeBatch("depleted", "d1", "DD", "2026-12-01", 0, 10)
	shelfStore.batches["depleted"] = dead
	svc := NewService(newFakeOrders(), drugs, shelfStore, nil, nil)
	created, err := svc.Create(context.Background(), Patient{NameFa: "بیمار"}, nil, requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	view, err := svc.AddLine(context.Background(), created.ID, LineInput{DrugID: "d1", Quantity: 1})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	return svc, view
}

func activeBatch(id, drugID, batchNo, expiry string, qty int, price int) shelf.StockBatch {
	return shelf.StockBatch{
		ID: id, DrugID: drugID, BatchNo: batchNo, Expiry: expiry,
		Quantity: qty, Status: "active", ConsumerPriceRial: price, UnitLabel: "عدد",
	}
}

func assertConflict(t *testing.T, err error) {
	t.Helper()
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "conflict" || app.Message != "فقط پیش‌نویس قابل ویرایش است" {
		t.Fatalf("expected conflict, got %v", err)
	}
}

func assertNotFound(t *testing.T, err error, message string) {
	t.Helper()
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "not_found" || app.Message != message {
		t.Fatalf("expected not_found %q, got %v", message, err)
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

type fakeOrders struct {
	items map[string]Order
}

func newFakeOrders() *fakeOrders {
	return &fakeOrders{items: map[string]Order{}}
}

func (f *fakeOrders) Insert(_ context.Context, order Order) error {
	if _, ok := f.items[order.ID]; ok {
		return errors.New("duplicate")
	}
	f.items[order.ID] = cloneOrder(order)
	return nil
}

func (f *fakeOrders) Get(_ context.Context, id string) (*Order, error) {
	order, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	copied := cloneOrder(order)
	return &copied, nil
}

func (f *fakeOrders) List(_ context.Context, status string, page, pageSize int) ([]Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 25
	}
	all := make([]Order, 0, len(f.items))
	for _, order := range f.items {
		if status != "" && order.Status != status {
			continue
		}
		all = append(all, cloneOrder(order))
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
		return []Order{}, total, nil
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], total, nil
}

func (f *fakeOrders) Replace(_ context.Context, order Order) error {
	if _, ok := f.items[order.ID]; !ok {
		return errors.New("missing")
	}
	f.items[order.ID] = cloneOrder(order)
	return nil
}

func cloneOrder(order Order) Order {
	if order.Lines != nil {
		lines := make([]Line, len(order.Lines))
		for i, line := range order.Lines {
			lines[i] = line
			if line.Controlled != nil {
				copied := *line.Controlled
				lines[i].Controlled = &copied
			}
		}
		order.Lines = lines
	}
	return order
}

type fakeDrugs struct {
	items       map[string]*drug.Drug
	byGTIN      map[string]*drug.Drug
	gtinLookups []string
}

func newFakeDrugs() *fakeDrugs {
	return &fakeDrugs{items: map[string]*drug.Drug{}, byGTIN: map[string]*drug.Drug{}}
}

func (f *fakeDrugs) Get(_ context.Context, id string) (*drug.Drug, error) {
	d, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	copied := *d
	return &copied, nil
}

func (f *fakeDrugs) FindByGTIN(_ context.Context, gtin string, _ string) (*drug.Drug, error) {
	f.gtinLookups = append(f.gtinLookups, gtin)
	d, ok := f.byGTIN[gtin]
	if !ok {
		return nil, nil
	}
	copied := *d
	return &copied, nil
}

type fakeShelf struct {
	byDrug     map[string][]shelf.StockBatch
	batches    map[string]shelf.StockBatch
	bins       map[string]*shelf.Bin
	binGets    []string
	qtyUpdates []qtyUpdate
}

type qtyUpdate struct {
	id  string
	qty int
}

func newFakeShelf() *fakeShelf {
	return &fakeShelf{
		byDrug:  map[string][]shelf.StockBatch{},
		batches: map[string]shelf.StockBatch{},
		bins:    map[string]*shelf.Bin{},
	}
}

func (f *fakeShelf) BatchesByDrug(_ context.Context, drugID string) ([]shelf.StockBatch, error) {
	items := f.byDrug[drugID]
	out := make([]shelf.StockBatch, len(items))
	copy(out, items)
	return out, nil
}

func (f *fakeShelf) GetBatch(_ context.Context, id string) (*shelf.StockBatch, error) {
	b, ok := f.batches[id]
	if !ok {
		return nil, nil
	}
	copied := b
	return &copied, nil
}

func (f *fakeShelf) GetBin(_ context.Context, id string) (*shelf.Bin, error) {
	f.binGets = append(f.binGets, id)
	b, ok := f.bins[id]
	if !ok {
		return nil, nil
	}
	copied := *b
	return &copied, nil
}

func (f *fakeShelf) UpdateBatchStatus(_ context.Context, id, status string) error {
	b, ok := f.batches[id]
	if !ok {
		return errors.New("missing batch")
	}
	b.Status = status
	f.batches[id] = b
	return nil
}

func (f *fakeShelf) UpdateBatchQuantity(_ context.Context, id string, quantity int) error {
	b, ok := f.batches[id]
	if !ok {
		return errors.New("missing batch")
	}
	b.Quantity = quantity
	if quantity <= 0 {
		b.Status = "depleted"
	}
	f.batches[id] = b
	f.qtyUpdates = append(f.qtyUpdates, qtyUpdate{id: id, qty: quantity})
	return nil
}

type fakeCardex struct {
	inputs []cardex.AppendInput
	calls  int
	failOn int
	err    error
}

func (f *fakeCardex) Append(_ context.Context, in cardex.AppendInput) (cardex.Movement, error) {
	f.calls++
	if f.failOn > 0 && f.calls == f.failOn {
		if f.err != nil {
			return cardex.Movement{}, f.err
		}
		return cardex.Movement{}, errors.New("cardex failed")
	}
	f.inputs = append(f.inputs, in)
	return cardex.Movement{Type: in.Type, QtyOut: in.QtyOut}, nil
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
