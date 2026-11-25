package reconciliation

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/expiry"
	"pharmastock/backend/internal/receipt"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/requestctx"
)

type fakeStore struct {
	items map[string]Reconciliation
}

func newFakeStore() *fakeStore {
	return &fakeStore{items: map[string]Reconciliation{}}
}

func (f *fakeStore) Insert(_ context.Context, rec Reconciliation) error {
	f.items[rec.ID] = rec
	return nil
}

func (f *fakeStore) Get(_ context.Context, id string) (*Reconciliation, error) {
	r, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	cp := r
	cp.Rows = append([]ReconciledRow(nil), r.Rows...)
	return &cp, nil
}

func (f *fakeStore) List(_ context.Context, status string, page, pageSize int) ([]Reconciliation, int64, error) {
	var out []Reconciliation
	for _, r := range f.items {
		if status == "" || r.Status == status {
			out = append(out, r)
		}
	}
	return out, int64(len(out)), nil
}

func (f *fakeStore) Replace(_ context.Context, rec Reconciliation) error {
	f.items[rec.ID] = rec
	return nil
}

func (f *fakeStore) ClaimPending(_ context.Context, id string) (bool, error) {
	r, ok := f.items[id]
	if !ok || (r.Status != StatusUploaded && r.Status != StatusMapped) {
		return false, nil
	}
	r.Status = "confirming"
	f.items[id] = r
	return true, nil
}

type fakeDrugs struct {
	list []drug.Drug
}

func (f *fakeDrugs) All(_ context.Context) ([]drug.Drug, error) {
	return f.list, nil
}

func (f *fakeDrugs) Get(_ context.Context, id string) (*drug.Drug, error) {
	for _, d := range f.list {
		if d.ID == id {
			cp := d
			return &cp, nil
		}
	}
	return nil, nil
}

type fakeTTAC struct {
	prices map[string]int64
}

func (f *fakeTTAC) LookupTTAC(_ context.Context, q string) map[string]any {
	if p, ok := f.prices[q]; ok {
		return map[string]any{
			"status":  "found",
			"product": drug.TtacProduct{PackageConsumerPrice: p},
		}
	}
	return map[string]any{"status": "not_found"}
}

type fakeBatches struct {
	failAt  int
	created []shelf.StockBatch
	deleted []string
}

func (f *fakeBatches) CreateBatchCore(_ context.Context, req expiry.CreateRequest, _ string) (shelf.StockBatch, string, error) {
	if f.failAt > 0 && len(f.created)+1 == f.failAt {
		return shelf.StockBatch{}, "", errors.New("db insert failed")
	}
	b := shelf.StockBatch{
		ID:            "batch-" + req.BatchNo,
		DrugID:        req.DrugID,
		BatchNo:       req.BatchNo,
		Expiry:        req.Expiry,
		Quantity:      req.Quantity,
		Status:        req.Status,
		UnitLabel:     req.UnitLabel,
		LocationLabel: req.LocationLabel,
		BinID:         req.BinID,
		IsControlled:  req.DrugID == "drug-morphine",
	}
	f.created = append(f.created, b)
	return b, "mov-" + req.BatchNo, nil
}

func (f *fakeBatches) DeleteBatch(_ context.Context, id string) error {
	f.deleted = append(f.deleted, id)
	return nil
}

type fakeCardex struct {
	deleted []string
}

func (f *fakeCardex) Delete(_ context.Context, id string) error {
	f.deleted = append(f.deleted, id)
	return nil
}

type fakeShelves struct{}

func (fakeShelves) ListBins(_ context.Context) ([]shelf.Bin, error) {
	return []shelf.Bin{{ID: "bin-a030204", Address: "A-03-2-04", MacroLocation: "main"}}, nil
}

type fakeReceipts struct {
	inserted []receipt.Receipt
	deleted  []string
}

func (f *fakeReceipts) Insert(_ context.Context, rec receipt.Receipt) error {
	f.inserted = append(f.inserted, rec)
	return nil
}

func (f *fakeReceipts) Delete(_ context.Context, id string) error {
	f.deleted = append(f.deleted, id)
	return nil
}

type fakeAudit struct {
	events []audit.AppendInput
}

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	f.events = append(f.events, in)
	return audit.Event{ID: "aud-1"}, nil
}

func testActor() requestctx.Actor {
	return requestctx.Actor{UserID: "u1", Name: "دکتر رضایی", Role: "technical_officer", Initials: "در"}
}

func newTestService(batches *fakeBatches, receipts *fakeReceipts, auditLog *fakeAudit) (*Service, *fakeDrugs) {
	drugs := &fakeDrugs{
		list: []drug.Drug{
			{ID: "drug-amox", NameFa: "آموکسی‌سیلین", DosageForm: "کپسول", Strength: "500mg", GTIN: "6260001000001", GenericCode: "12345", UnitCost: 45000, UnitLabel: "عدد"},
			{ID: "drug-insulin", NameFa: "انسولین قلمی", DosageForm: "قلم تزریقی", Strength: "100IU/ml", GTIN: "6260001000002", GenericCode: "77881", UnitCost: 890000, UnitLabel: "قلم"},
		},
	}
	ttac := &fakeTTAC{prices: map[string]int64{"6260001000001": 45000, "6260001000002": 890000}}
	svc := NewService(newFakeStore(), drugs, ttac, batches, batches, &fakeCardex{}, fakeShelves{}, receipts, auditLog)
	svc.now = func() time.Time { return time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC) }
	return svc, drugs
}

func TestUploadReconcileEditAndConfirmFlow(t *testing.T) {
	ctx := context.Background()
	batches := &fakeBatches{}
	receipts := &fakeReceipts{}
	auditLog := &fakeAudit{}
	svc, drugs := newTestService(batches, receipts, auditLog)

	csv := "نام کالا,بارکد,شناسه IRC,سری ساخت,تاریخ انقضا,تعداد,قیمت خرید,قیمت مصرف‌کننده\n" +
		"آموکسی‌سیلین,6260001000001,12345,AX-1,1406/03/15,10,45000,45000\n" +
		"انسولین قلمی,6260001000002,77881,IN-2,1406/04/10,5,910000,910000\n" +
		"داروی جدید تست,6269999000009,99999,NW-1,1406/05/01,2,100000,100000\n"

	view, err := svc.UploadFile(ctx, "test.csv", []byte(csv), UploadMeta{
		InvoiceNo: "INV-101", Distributor: "پخش هجرت",
	}, testActor())
	if err != nil {
		t.Fatalf("UploadFile: %v", err)
	}
	if view.Summary.TotalRows != 3 || view.Summary.MatchedCount != 1 || view.Summary.PriceMismatchCount != 1 || view.Summary.NewItemCount != 1 {
		t.Fatalf("unexpected summary after upload: %+v", view.Summary)
	}
	if view.Summary.CanConfirm {
		t.Fatalf("expected CanConfirm=false when new_item and mismatch exist")
	}

	// Confirm must fail with 422 before resolving new item
	if _, err := svc.Confirm(ctx, view.ID, testActor(), "127.0.0.1"); err == nil {
		t.Fatalf("expected Confirm validation error")
	}

	// Register the new drug and rematch
	drugs.list = append(drugs.list, drug.Drug{
		ID: "drug-new", NameFa: "داروی جدید تست", GTIN: "6269999000009", GenericCode: "99999", UnitCost: 100000, UnitLabel: "عدد",
	})
	view, err = svc.Rematch(ctx, view.ID, RematchRequest{})
	if err != nil {
		t.Fatalf("Rematch: %v", err)
	}
	if view.Summary.NewItemCount != 0 || view.Summary.MatchedCount != 2 {
		t.Fatalf("expected new item resolved after Rematch, got %+v", view.Summary)
	}

	// Confirm still blocked by unapproved price mismatch
	if _, err := svc.Confirm(ctx, view.ID, testActor(), "127.0.0.1"); err == nil {
		t.Fatalf("expected Confirm validation error for unapproved price mismatch")
	}

	// Technical approval on mismatch row
	var mismatchID string
	for _, r := range view.Rows {
		if r.MatchStatus == RowPriceMismatch {
			mismatchID = r.ID
		}
	}
	approved := true
	view, err = svc.PatchRow(ctx, view.ID, mismatchID, RowPatch{PriceApproved: &approved}, testActor())
	if err != nil {
		t.Fatalf("PatchRow: %v", err)
	}
	if !view.Summary.CanConfirm {
		t.Fatalf("expected CanConfirm=true after price approval, got %+v", view.Summary)
	}

	confirmed, err := svc.Confirm(ctx, view.ID, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("Confirm: %v", err)
	}
	if confirmed.Status != StatusConfirmed || confirmed.CreatedReceiptID == "" || len(confirmed.CreatedBatchIDs) != 3 {
		t.Fatalf("unexpected confirmed state: %+v", confirmed)
	}
	if len(batches.created) != 3 || batches.created[0].Status != "quarantined" {
		t.Fatalf("expected 3 quarantined batches created, got %+v", batches.created)
	}
	if len(receipts.inserted) != 1 || len(auditLog.events) != 2 {
		t.Fatalf("expected 1 receipt and 2 audit events (stock_receipt + price_mod), got receipts=%d audits=%d", len(receipts.inserted), len(auditLog.events))
	}

	// Second confirm must return 409 Conflict
	_, err = svc.Confirm(ctx, view.ID, testActor(), "127.0.0.1")
	var appErr *errormap.AppError
	if !errors.As(err, &appErr) || appErr.HTTPStatus != http.StatusConflict {
		t.Fatalf("expected 409 Conflict on double confirm, got %v", err)
	}
}

func TestConfirmRollbackOnPartialFailure(t *testing.T) {
	ctx := context.Background()
	batches := &fakeBatches{failAt: 2}
	receipts := &fakeReceipts{}
	auditLog := &fakeAudit{}
	svc, _ := newTestService(batches, receipts, auditLog)

	csv := "نام کالا,بارکد,سری ساخت,تاریخ انقضا,تعداد,قیمت خرید,قیمت مصرف‌کننده\n" +
		"آموکسی‌سیلین,6260001000001,AX-1,1406/03/15,10,45000,45000\n" +
		"انسولین قلمی,6260001000002,IN-2,1406/04/10,5,890000,890000\n"

	view, err := svc.UploadFile(ctx, "rb.csv", []byte(csv), UploadMeta{
		InvoiceNo: "INV-RB", Distributor: "پخش رازی",
	}, testActor())
	if err != nil {
		t.Fatalf("UploadFile: %v", err)
	}
	if _, err := svc.Confirm(ctx, view.ID, testActor(), "127.0.0.1"); err == nil {
		t.Fatalf("expected error on second batch failure")
	}
	if len(batches.deleted) != 1 {
		t.Fatalf("expected first created batch rolled back, deleted=%v", batches.deleted)
	}
	after, err := svc.Get(ctx, view.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if after.Status != StatusMapped {
		t.Fatalf("expected status reverted to mapped, got %s", after.Status)
	}
}
