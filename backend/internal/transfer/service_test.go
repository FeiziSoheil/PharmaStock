package transfer

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

func TestCreateDraft(t *testing.T) {
	svc := newDraftService(newFakeRepo(), newFakeShelf())
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}

	view, err := svc.Create(context.Background(), validCreateHeader(), actor)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if view.ID == "" {
		t.Fatal("expected id")
	}
	if view.Status != StatusDraft || view.CurrentStep != 1 {
		t.Fatalf("status/step = %s %d", view.Status, view.CurrentStep)
	}
	if view.Lines == nil || len(view.Lines) != 0 {
		t.Fatalf("lines = %#v", view.Lines)
	}
	if view.CreatedAt == "" || view.UpdatedAt == "" {
		t.Fatal("expected RFC3339 timestamps")
	}
}

func TestCreateHeaderValidation(t *testing.T) {
	svc := newDraftService(newFakeRepo(), newFakeShelf())
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}
	cases := []struct {
		name  string
		edit  func(*CreateHeader)
		field string
		msg   string
	}{
		{name: "source", edit: func(h *CreateHeader) { h.SourceLabel = "  " }, field: "sourceLabel", msg: "مبدأ انتقال الزامی است"},
		{name: "reason", edit: func(h *CreateHeader) { h.Reason = "other" }, field: "reason", msg: "دلیل انتقال نامعتبر است"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := validCreateHeader()
			tc.edit(&h)
			_, err := svc.Create(context.Background(), h, actor)
			assertField(t, err, tc.field, tc.msg)
		})
	}
}

func TestAddLineCopiesBatchFields(t *testing.T) {
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 20, Status: "active", UnitLabel: "عدد", BinID: "bin-src", LocationLabel: "سالن A",
	}
	shelfFake.bins["bin-dest"] = shelf.Bin{ID: "bin-dest", Address: "پیشخوان 2 > B"}
	svc := newDraftService(newFakeRepo(), shelfFake)
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}

	created, err := svc.Create(context.Background(), validCreateHeader(), actor)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added, err := svc.AddLine(context.Background(), created.ID, AddLineRequest{
		SourceBatchID: "batch-1", Quantity: 5, DestBinID: "bin-dest", MatchStatus: "barcode",
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if len(added.Lines) != 1 {
		t.Fatalf("lines = %d", len(added.Lines))
	}
	line := added.Lines[0]
	if line.ID == "" || line.DrugID != "d1" || line.NameFa != "استامینوفن" {
		t.Fatalf("line = %+v", line)
	}
	if line.BatchNo != "B-1" || line.Expiry != "2027-01-01" || line.SourceBatchID != "batch-1" {
		t.Fatalf("batch meta = %+v", line)
	}
	if line.SourceBinID != "bin-src" || line.SourceLocationLabel != "سالن A" {
		t.Fatalf("source loc = %+v", line)
	}
	if line.DestBinID != "bin-dest" || line.DestLocationLabel != "پیشخوان 2 > B" {
		t.Fatalf("dest = %+v", line)
	}
	if line.Quantity != 5 || line.MatchStatus != "barcode" {
		t.Fatalf("qty/match = %d %s", line.Quantity, line.MatchStatus)
	}
}

func TestAddLineRejectsQtyAboveAvailable(t *testing.T) {
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", Quantity: 3, Status: "active"}
	svc := newDraftService(newFakeRepo(), shelfFake)
	created, err := svc.Create(context.Background(), validCreateHeader(), requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, AddLineRequest{SourceBatchID: "batch-1", Quantity: 4})
	assertField(t, err, "quantity", "تعداد بیش از موجودی بچ است")
}

func TestAddLineRejectsMissingBatch(t *testing.T) {
	svc := newDraftService(newFakeRepo(), newFakeShelf())
	created, err := svc.Create(context.Background(), validCreateHeader(), requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, AddLineRequest{SourceBatchID: "missing", Quantity: 1})
	var app *errormap.AppError
	if !errors.As(err, &app) || app.Code != "not_found" || app.Message != "بچ موجودی یافت نشد" {
		t.Fatalf("missing batch: %v", err)
	}
}

func TestPatchLineRefreshesDestLabelWhenBinChanges(t *testing.T) {
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 10, Status: "active", UnitLabel: "عدد", LocationLabel: "A-01",
	}
	shelfFake.bins["bin-1"] = shelf.Bin{ID: "bin-1", Address: "C-01-1-01"}
	shelfFake.bins["bin-2"] = shelf.Bin{ID: "bin-2", Address: "C-01-1-02"}

	svc := newDraftService(newFakeRepo(), shelfFake)
	ctx := context.Background()
	created, err := svc.Create(ctx, validCreateHeader(), requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added, err := svc.AddLine(ctx, created.ID, AddLineRequest{
		SourceBatchID: "batch-1", Quantity: 2, DestBinID: "bin-1",
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	newBin := "bin-2"
	updated, err := svc.PatchLine(ctx, created.ID, added.Lines[0].ID, PatchLineRequest{
		DestBinID: &newBin,
	})
	if err != nil {
		t.Fatalf("patch line: %v", err)
	}
	if updated.Lines[0].DestBinID != "bin-2" || updated.Lines[0].DestLocationLabel != "C-01-1-02" {
		t.Fatalf("expected refreshed dest label, got %+v", updated.Lines[0])
	}
}

func TestMutatingConfirmedTransferRejected(t *testing.T) {
	repo := newFakeRepo()
	repo.items["c1"] = Transfer{
		ID: "c1", Status: StatusConfirmed, CurrentStep: 2,
		Header: validCreateHeader().toHeader(),
		Lines:  []Line{{ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01", SourceBatchID: "batch-1", SourceLocationLabel: "A", Quantity: 1, UnitLabel: "عدد", MatchStatus: "barcode"}},
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-2", Expiry: "2027-02-01", Quantity: 5, Status: "active"}
	svc := newDraftService(repo, shelfFake)
	ctx := context.Background()

	_, err := svc.AddLine(ctx, "c1", AddLineRequest{SourceBatchID: "batch-1", Quantity: 1})
	assertConflict(t, err)
	note := "یادداشت"
	_, err = svc.Patch(ctx, "c1", PatchBody{Note: &note})
	assertConflict(t, err)
	qty := 2
	_, err = svc.PatchLine(ctx, "c1", "l1", PatchLineRequest{Quantity: &qty})
	assertConflict(t, err)
	_, err = svc.DeleteLine(ctx, "c1", "l1")
	assertConflict(t, err)

	got, err := svc.Get(ctx, "c1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Status != StatusConfirmed || len(got.Lines) != 1 || got.Lines[0].BatchNo != "B-1" {
		t.Fatalf("confirmed mutated: %+v", got)
	}
}

func TestConfirmFullMove(t *testing.T) {
	repo := newFakeRepo()
	now := time.Date(2026, 11, 12, 9, 0, 0, 0, time.UTC)
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 10, Status: "active", UnitLabel: "عدد", BinID: "bin-src", LocationLabel: "سالن A", Zone: "warehouse",
	}
	shelfFake.bins["bin-dest"] = shelf.Bin{ID: "bin-dest", Zone: "dispensing", Address: "پیشخوان 2"}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, CurrentStep: 2, Header: validCreateHeader().toHeader(),
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
			SourceBatchID: "batch-1", SourceLocationLabel: "سالن A", DestBinID: "bin-dest", DestLocationLabel: "پیشخوان 2",
			Quantity: 10, UnitLabel: "عدد", MatchStatus: "barcode",
		}},
		CreatedAt: now, UpdatedAt: now,
	}
	cx := &fakeCardex{}
	audits := &fakeAudit{}
	svc := newConfirmService(repo, shelfFake, cx, audits)
	svc.now = func() time.Time { return now }
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator", BranchID: "br1"}

	view, err := svc.Confirm(context.Background(), "t1", actor, "10.0.0.1")
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if view.Status != StatusConfirmed || view.ConfirmedAt == "" {
		t.Fatalf("view = %+v", view)
	}
	if !strings.HasPrefix(view.TransferNo, "TRF-20261112-") {
		t.Fatalf("transferNo = %q", view.TransferNo)
	}
	if len(view.ResultBatchIDs) != 1 || view.ResultBatchIDs[0] != "batch-1" {
		t.Fatalf("result batches = %#v", view.ResultBatchIDs)
	}
	b := shelfFake.batches["batch-1"]
	if b.Quantity != 10 || b.BinID != "bin-dest" || b.LocationLabel != "پیشخوان 2" || b.Zone != "dispensing" {
		t.Fatalf("batch after move = %+v", b)
	}
	if len(cx.inputs) != 1 {
		t.Fatalf("cardex = %d", len(cx.inputs))
	}
	if cx.inputs[0].Type != "transfer" || cx.inputs[0].QtyIn != 10 || cx.inputs[0].QtyOut != 10 {
		t.Fatalf("cardex = %+v", cx.inputs[0])
	}
	if !strings.Contains(cx.inputs[0].Note, "سالن A") || !strings.Contains(cx.inputs[0].Note, "پیشخوان 2") {
		t.Fatalf("cardex note = %q", cx.inputs[0].Note)
	}
	if len(audits.inputs) != 1 || audits.inputs[0].Action != "transfer" || audits.inputs[0].EntityType != "transfer" {
		t.Fatalf("audit = %+v", audits.inputs)
	}
}

func TestConfirmSplit(t *testing.T) {
	repo := newFakeRepo()
	now := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 10, Status: "active", UnitLabel: "عدد", BinID: "bin-src", LocationLabel: "سالن A",
		BuyPriceRial: 1000, ConsumerPriceRial: 1500, IsControlled: false,
	}
	shelfFake.bins["bin-dest"] = shelf.Bin{ID: "bin-dest", Zone: "dispensing", Address: "پیشخوان 2"}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, Header: validCreateHeader().toHeader(),
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
			SourceBatchID: "batch-1", SourceLocationLabel: "سالن A", DestLocationLabel: "پیشخوان 2", DestBinID: "bin-dest",
			Quantity: 4, UnitLabel: "عدد", MatchStatus: "barcode",
		}},
		CreatedAt: now, UpdatedAt: now,
	}
	svc := newConfirmService(repo, shelfFake, &fakeCardex{}, &fakeAudit{})
	svc.now = func() time.Time { return now }
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}

	view, err := svc.Confirm(context.Background(), "t1", actor, "127.0.0.1")
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if shelfFake.batches["batch-1"].Quantity != 6 {
		t.Fatalf("source qty = %d", shelfFake.batches["batch-1"].Quantity)
	}
	if len(view.ResultBatchIDs) != 1 {
		t.Fatalf("result = %#v", view.ResultBatchIDs)
	}
	nb := shelfFake.batches[view.ResultBatchIDs[0]]
	if nb.Quantity != 4 || nb.DrugID != "d1" || nb.BatchNo != "B-1" || nb.BuyPriceRial != 1000 {
		t.Fatalf("new batch = %+v", nb)
	}
	if nb.BinID != "bin-dest" || nb.LocationLabel != "پیشخوان 2" {
		t.Fatalf("new batch loc = %+v", nb)
	}
	if view.ResultBatchIDs[0] == "batch-1" {
		t.Fatal("split should create new batch id")
	}
}

func TestConfirmTwiceConflict(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now().UTC()
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", Quantity: 5, Status: "active", LocationLabel: "A"}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, Header: validCreateHeader().toHeader(),
		Lines: []Line{{ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", SourceBatchID: "batch-1", SourceLocationLabel: "A", DestLocationLabel: "B", Quantity: 5, UnitLabel: "عدد", MatchStatus: "barcode"}},
		CreatedAt: now, UpdatedAt: now,
	}
	svc := newConfirmService(repo, shelfFake, &fakeCardex{}, &fakeAudit{})
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}
	ctx := context.Background()
	if _, err := svc.Confirm(ctx, "t1", actor, "127.0.0.1"); err != nil {
		t.Fatalf("first confirm: %v", err)
	}
	_, err := svc.Confirm(ctx, "t1", actor, "127.0.0.1")
	assertConflict(t, err)
}

func TestConfirmInsufficientQtyStillDraft(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now().UTC()
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", Quantity: 3, Status: "active", LocationLabel: "A"}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, Header: validCreateHeader().toHeader(),
		Lines: []Line{{ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", SourceBatchID: "batch-1", SourceLocationLabel: "A", DestLocationLabel: "B", Quantity: 5, UnitLabel: "عدد", MatchStatus: "barcode"}},
		CreatedAt: now, UpdatedAt: now,
	}
	cx := &fakeCardex{}
	svc := newConfirmService(repo, shelfFake, cx, &fakeAudit{})
	actor := requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"}
	_, err := svc.Confirm(context.Background(), "t1", actor, "127.0.0.1")
	assertField(t, err, "quantity", "تعداد بیش از موجودی بچ است")
	got, gerr := svc.Get(context.Background(), "t1")
	if gerr != nil {
		t.Fatalf("get: %v", gerr)
	}
	if got.Status != StatusDraft || got.TransferNo != "" {
		t.Fatalf("still draft expected, got %+v", got)
	}
	if len(cx.inputs) != 0 {
		t.Fatal("cardex should not run")
	}
}

func TestClaimForConfirmPreventsOverlap(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now().UTC()
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, Header: validCreateHeader().toHeader(),
		Lines:     []Line{{ID: "l1", SourceBatchID: "batch-1", Quantity: 1}},
		CreatedAt: now, UpdatedAt: now,
	}
	ok1, err := repo.ClaimForConfirm(context.Background(), "t1")
	if err != nil || !ok1 {
		t.Fatalf("first claim: ok=%v err=%v", ok1, err)
	}
	ok2, err := repo.ClaimForConfirm(context.Background(), "t1")
	if err != nil || ok2 {
		t.Fatalf("second claim should lose: ok=%v err=%v", ok2, err)
	}
}

func TestConfirmTwoLinesSameBatchExceedsQty(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now().UTC()
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01",
		Quantity: 10, Status: "active", LocationLabel: "A",
	}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, Header: validCreateHeader().toHeader(),
		Lines: []Line{
			{ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", SourceBatchID: "batch-1", SourceLocationLabel: "A", DestLocationLabel: "B", Quantity: 10, UnitLabel: "عدد", MatchStatus: "barcode"},
			{ID: "l2", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01", SourceBatchID: "batch-1", SourceLocationLabel: "A", DestLocationLabel: "C", Quantity: 10, UnitLabel: "عدد", MatchStatus: "barcode"},
		},
		CreatedAt: now, UpdatedAt: now,
	}
	svc := newConfirmService(repo, shelfFake, &fakeCardex{}, &fakeAudit{})
	_, err := svc.Confirm(context.Background(), "t1", requestctx.Actor{UserID: "u1", Name: "اپراتور"}, "127.0.0.1")
	assertField(t, err, "quantity", "تعداد بیش از موجودی بچ است")
	got, _ := svc.Get(context.Background(), "t1")
	if got.Status != StatusDraft {
		t.Fatalf("expected draft after failed confirm, got %s", got.Status)
	}
}

func TestConfirmSplitInsertFailureRestoresSource(t *testing.T) {
	repo := newFakeRepo()
	now := time.Now().UTC()
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01",
		Quantity: 10, Status: "active", LocationLabel: "A",
	}
	shelfFake.insertErr = errors.New("insert failed")
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, Header: validCreateHeader().toHeader(),
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01",
			SourceBatchID: "batch-1", SourceLocationLabel: "A", DestLocationLabel: "B",
			Quantity: 4, UnitLabel: "عدد", MatchStatus: "barcode",
		}},
		CreatedAt: now, UpdatedAt: now,
	}
	svc := newConfirmService(repo, shelfFake, &fakeCardex{}, &fakeAudit{})
	_, err := svc.Confirm(context.Background(), "t1", requestctx.Actor{UserID: "u1", Name: "اپراتور"}, "127.0.0.1")
	if err == nil {
		t.Fatal("expected insert error")
	}
	if shelfFake.batches["batch-1"].Quantity != 10 {
		t.Fatalf("source qty = %d, want 10", shelfFake.batches["batch-1"].Quantity)
	}
	got, _ := svc.Get(context.Background(), "t1")
	if got.Status != StatusDraft {
		t.Fatalf("status = %s", got.Status)
	}
}

func TestAddLineRejectsInactiveBatch(t *testing.T) {
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01",
		Quantity: 5, Status: "quarantined",
	}
	svc := newDraftService(newFakeRepo(), shelfFake)
	created, _ := svc.Create(context.Background(), validCreateHeader(), requestctx.Actor{UserID: "u1"})
	_, err := svc.AddLine(context.Background(), created.ID, AddLineRequest{SourceBatchID: "batch-1", Quantity: 1})
	assertField(t, err, "sourceBatchId", "بچ منبع فعال نیست")
}

func TestListDrafts(t *testing.T) {
	repo := newFakeRepo()
	repo.items["c1"] = Transfer{ID: "c1", Status: StatusConfirmed, Header: validCreateHeader().toHeader(), Lines: []Line{}, UpdatedAt: time.Now().UTC()}
	svc := newDraftService(repo, newFakeShelf())
	created, err := svc.Create(context.Background(), validCreateHeader(), requestctx.Actor{UserID: "u1", Name: "اپراتور", Role: "warehouse_operator"})
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
}

func TestAddAndPatchLineCumulativeQtyExceedsBatch(t *testing.T) {
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "استامینوفن", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 10, Status: "active", UnitLabel: "عدد", LocationLabel: "A-01",
	}
	svc := newDraftService(newFakeRepo(), shelfFake)
	created, err := svc.Create(context.Background(), validCreateHeader(), requestctx.Actor{UserID: "u1"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	added1, err := svc.AddLine(context.Background(), created.ID, AddLineRequest{
		SourceBatchID: "batch-1", Quantity: 6, DestLocationLabel: "C-01",
	})
	if err != nil {
		t.Fatalf("add 1: %v", err)
	}
	_, err = svc.AddLine(context.Background(), created.ID, AddLineRequest{
		SourceBatchID: "batch-1", Quantity: 5, DestLocationLabel: "C-02",
	})
	assertField(t, err, "quantity", "تعداد بیش از موجودی بچ است")

	added2, err := svc.AddLine(context.Background(), created.ID, AddLineRequest{
		SourceBatchID: "batch-1", Quantity: 2, DestLocationLabel: "C-02",
	})
	if err != nil {
		t.Fatalf("add 2: %v", err)
	}
	line2ID := added2.Lines[1].ID
	badQty := 5
	_, err = svc.PatchLine(context.Background(), created.ID, line2ID, PatchLineRequest{Quantity: &badQty})
	assertField(t, err, "quantity", "تعداد بیش از موجودی بچ است")

	okQty := 4
	patched, err := svc.PatchLine(context.Background(), created.ID, line2ID, PatchLineRequest{Quantity: &okQty})
	if err != nil {
		t.Fatalf("patch valid qty: %v", err)
	}
	if patched.Lines[0].Quantity != 6 || patched.Lines[1].Quantity != 4 {
		t.Fatalf("unexpected quantities: %+v", added1.Lines)
	}
}

func TestClearLinesDraftAndConfirmed(t *testing.T) {
	repo := newFakeRepo()
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B", Expiry: "2027-01-01",
		Quantity: 5, Status: "active", LocationLabel: "A",
	}
	svc := newDraftService(repo, shelfFake)
	created, _ := svc.Create(context.Background(), validCreateHeader(), requestctx.Actor{UserID: "u1"})
	_, err := svc.AddLine(context.Background(), created.ID, AddLineRequest{
		SourceBatchID: "batch-1", Quantity: 2, DestLocationLabel: "B",
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	cleared, err := svc.ClearLines(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("clear: %v", err)
	}
	if len(cleared.Lines) != 0 {
		t.Fatalf("expected 0 lines, got %d", len(cleared.Lines))
	}

	repo.items["confirmed-1"] = Transfer{ID: "confirmed-1", Status: StatusConfirmed, Header: validCreateHeader().toHeader(), Lines: []Line{{ID: "l1"}}}
	_, err = svc.ClearLines(context.Background(), "confirmed-1")
	assertConflict(t, err)
}

func TestConfirmDestBinIDOnly(t *testing.T) {
	repo := newFakeRepo()
	now := time.Date(2026, 11, 12, 11, 0, 0, 0, time.UTC)
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 5, Status: "active", BinID: "bin-src", LocationLabel: "A-03-2-04", Zone: "A",
	}
	shelfFake.bins["bin-dest"] = shelf.Bin{ID: "bin-dest", Zone: "C", Address: "C-01-1-01"}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, CurrentStep: 2, Header: validCreateHeader().toHeader(),
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01",
			SourceBatchID: "batch-1", SourceLocationLabel: "A-03-2-04", DestBinID: "bin-dest",
			Quantity: 5, UnitLabel: "عدد", MatchStatus: "barcode",
		}},
		CreatedAt: now, UpdatedAt: now,
	}
	cx := &fakeCardex{}
	svc := newConfirmService(repo, shelfFake, cx, &fakeAudit{})
	svc.now = func() time.Time { return now }
	view, err := svc.Confirm(context.Background(), "t1", requestctx.Actor{UserID: "u1", Name: "اپراتور"}, "127.0.0.1")
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if view.Status != StatusConfirmed {
		t.Fatalf("status = %s", view.Status)
	}
	b := shelfFake.batches["batch-1"]
	if b.BinID != "bin-dest" || b.Zone != "C" || b.LocationLabel != "C-01-1-01" {
		t.Fatalf("batch loc = %+v", b)
	}
	if len(cx.inputs) != 1 || !strings.Contains(cx.inputs[0].Note, "C-01-1-01") {
		t.Fatalf("cardex note = %+v", cx.inputs)
	}
}

func TestConfirmLabelOnlyFullMoveClearsBinAndRollbacks(t *testing.T) {
	repo := newFakeRepo()
	now := time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC)
	shelfFake := newFakeShelf()
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 5, Status: "active", BinID: "bin-src", LocationLabel: "A-03-2-04", Zone: "A",
	}
	repo.items["t1"] = Transfer{
		ID: "t1", Status: StatusDraft, CurrentStep: 2, Header: validCreateHeader().toHeader(),
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01",
			SourceBatchID: "batch-1", SourceLocationLabel: "A-03-2-04", DestLocationLabel: "پیشخوان آزاد",
			Quantity: 5, UnitLabel: "عدد", MatchStatus: "physical",
		}},
		CreatedAt: now, UpdatedAt: now,
	}
	cx := &fakeCardex{}
	audits := &fakeAudit{}
	svc := newConfirmService(repo, shelfFake, cx, audits)
	svc.now = func() time.Time { return now }

	if _, err := svc.Confirm(context.Background(), "t1", requestctx.Actor{UserID: "u1", Name: "اپراتور"}, "127.0.0.1"); err != nil {
		t.Fatalf("confirm: %v", err)
	}
	b := shelfFake.batches["batch-1"]
	if b.LocationLabel != "پیشخوان آزاد" || b.BinID != "" || b.Zone != "" {
		t.Fatalf("expected cleared bin/zone, got %+v", b)
	}

	// Verify rollback restores BinID and Zone when audit fails on label-only full move
	repo.items["t2"] = Transfer{
		ID: "t2", Status: StatusDraft, CurrentStep: 2, Header: validCreateHeader().toHeader(),
		Lines: []Line{{
			ID: "l1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01",
			SourceBatchID: "batch-1", SourceLocationLabel: "A-03-2-04", DestLocationLabel: "پیشخوان موقت",
			Quantity: 5, UnitLabel: "عدد", MatchStatus: "physical",
		}},
		CreatedAt: now, UpdatedAt: now,
	}
	shelfFake.batches["batch-1"] = shelf.StockBatch{
		ID: "batch-1", DrugID: "d1", NameFa: "دارو", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 5, Status: "active", BinID: "bin-src", LocationLabel: "A-03-2-04", Zone: "A",
	}
	audits.err = errors.New("audit down")
	if _, err := svc.Confirm(context.Background(), "t2", requestctx.Actor{UserID: "u1", Name: "اپراتور"}, "127.0.0.1"); err == nil {
		t.Fatal("expected audit error")
	}
	restored := shelfFake.batches["batch-1"]
	if restored.LocationLabel != "A-03-2-04" || restored.BinID != "bin-src" || restored.Zone != "A" {
		t.Fatalf("expected restored loc, got %+v", restored)
	}
}

func validCreateHeader() CreateHeader {
	return CreateHeader{
		Reason: "routine_front", SourceZone: "warehouse", DestZone: "dispensing",
		SourceLabel: "انبار مرکزی", DestLabel: "پیشخوان نسخه‌پیچی",
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

func newDraftService(repo transferStore, shelf shelfStore) *Service {
	return NewService(repo, shelf, &fakeCardex{}, &fakeAudit{})
}

func newConfirmService(repo transferStore, shelf shelfStore, cx cardexWriter, au auditWriter) *Service {
	return NewService(repo, shelf, cx, au)
}

type fakeRepo struct {
	items map[string]Transfer
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{items: map[string]Transfer{}}
}

func (f *fakeRepo) Insert(_ context.Context, t Transfer) error {
	f.items[t.ID] = cloneTransfer(t)
	return nil
}

func (f *fakeRepo) Get(_ context.Context, id string) (*Transfer, error) {
	t, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	cp := cloneTransfer(t)
	return &cp, nil
}

func (f *fakeRepo) List(_ context.Context, status string, page, pageSize int) ([]Transfer, int64, error) {
	var out []Transfer
	for _, t := range f.items {
		if status != "" && t.Status != status {
			continue
		}
		out = append(out, cloneTransfer(t))
	}
	return out, int64(len(out)), nil
}

func (f *fakeRepo) Replace(_ context.Context, t Transfer) error {
	f.items[t.ID] = cloneTransfer(t)
	return nil
}

func (f *fakeRepo) ReplaceIfDraft(_ context.Context, t Transfer) (bool, error) {
	existing, ok := f.items[t.ID]
	if !ok || existing.Status != StatusDraft {
		return false, nil
	}
	f.items[t.ID] = cloneTransfer(t)
	return true, nil
}

func (f *fakeRepo) ClaimForConfirm(_ context.Context, id string) (bool, error) {
	t, ok := f.items[id]
	if !ok || t.Status != StatusDraft {
		return false, nil
	}
	t.Status = StatusConfirming
	f.items[id] = t
	return true, nil
}

func (f *fakeRepo) RevertToDraft(_ context.Context, id string) error {
	t, ok := f.items[id]
	if !ok {
		return nil
	}
	t.Status = StatusDraft
	t.ConfirmedAt = nil
	t.TransferNo = ""
	t.ResultBatchIDs = nil
	f.items[id] = t
	return nil
}

func cloneTransfer(t Transfer) Transfer {
	cp := t
	if t.Lines != nil {
		cp.Lines = make([]Line, len(t.Lines))
		copy(cp.Lines, t.Lines)
	}
	return cp
}

type fakeShelf struct {
	batches     map[string]shelf.StockBatch
	bins        map[string]shelf.Bin
	nextBatchID string
	insertErr   error
}

func newFakeShelf() *fakeShelf {
	return &fakeShelf{batches: map[string]shelf.StockBatch{}, bins: map[string]shelf.Bin{}}
}

func (f *fakeShelf) GetBatch(_ context.Context, id string) (*shelf.StockBatch, error) {
	b, ok := f.batches[id]
	if !ok {
		return nil, nil
	}
	cp := b
	return &cp, nil
}

func (f *fakeShelf) GetBin(_ context.Context, id string) (*shelf.Bin, error) {
	b, ok := f.bins[id]
	if !ok {
		return nil, nil
	}
	cp := b
	return &cp, nil
}

func (f *fakeShelf) UpdateBatchLocation(_ context.Context, id, locationLabel, binID, zone string) error {
	b, ok := f.batches[id]
	if !ok {
		return errors.New("batch missing")
	}
	b.LocationLabel = locationLabel
	if binID != "" {
		b.BinID = binID
	}
	if zone != "" {
		b.Zone = zone
	}
	f.batches[id] = b
	return nil
}

func (f *fakeShelf) UpdateBatch(_ context.Context, b shelf.StockBatch) error {
	if _, ok := f.batches[b.ID]; !ok {
		return errors.New("batch missing")
	}
	f.batches[b.ID] = b
	return nil
}

func (f *fakeShelf) InsertBatch(_ context.Context, b shelf.StockBatch) error {
	if f.insertErr != nil {
		return f.insertErr
	}
	if b.ID == "" {
		if f.nextBatchID != "" {
			b.ID = f.nextBatchID
		} else {
			b.ID = "inserted-" + b.BatchNo
		}
	}
	f.batches[b.ID] = b
	return nil
}

func (f *fakeShelf) DeleteBatch(_ context.Context, id string) error {
	delete(f.batches, id)
	return nil
}

type fakeCardex struct {
	inputs []cardex.AppendInput
	ids    []string
	err    error
	n      int
}

func (f *fakeCardex) Append(_ context.Context, in cardex.AppendInput) (cardex.Movement, error) {
	f.inputs = append(f.inputs, in)
	if f.err != nil {
		return cardex.Movement{}, f.err
	}
	f.n++
	id := fmt.Sprintf("mov-%d", f.n)
	f.ids = append(f.ids, id)
	return cardex.Movement{ID: id}, nil
}

func (f *fakeCardex) Delete(_ context.Context, id string) error {
	for i, mid := range f.ids {
		if mid == id {
			f.ids = append(f.ids[:i], f.ids[i+1:]...)
			break
		}
	}
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
