package controlled

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

type fakeLedgerRepo struct {
	seq       int64
	entries   []Entry
	insertErr error
}

func (f *fakeLedgerRepo) NextSeq(context.Context) (int64, error) {
	f.seq++
	return f.seq, nil
}

func (f *fakeLedgerRepo) Insert(_ context.Context, e Entry) error {
	if f.insertErr != nil {
		return f.insertErr
	}
	f.entries = append(f.entries, e)
	return nil
}

func (f *fakeLedgerRepo) List(_ context.Context, flt ListFilter) ([]Entry, int64, error) {
	out := make([]Entry, 0, len(f.entries))
	for _, e := range f.entries {
		if flt.DrugID != "" && e.DrugID != flt.DrugID {
			continue
		}
		if flt.TxType != "" && e.TxType != flt.TxType {
			continue
		}
		out = append(out, e)
	}
	return out, int64(len(out)), nil
}

func (f *fakeLedgerRepo) AggregateStats(_ context.Context, _ time.Time) (AggregatedStats, error) {
	var stats AggregatedStats
	stats.TotalEntries = int64(len(f.entries))
	for _, e := range f.entries {
		if e.TxType == TxInDistributor {
			stats.MonthInflow += e.QtyIn
			stats.MonthInflowShipments++
		}
		if e.TxType == TxOutPrescription {
			stats.MonthOutflow += e.QtyOut
			stats.ActivePrescriptionCount++
		}
		stats.WasteDestroyedCount += e.AmpouleWasteCount
	}
	return stats, nil
}

type fakeDrugs struct {
	items map[string]drug.Drug
}

func (f *fakeDrugs) Get(_ context.Context, id string) (*drug.Drug, error) {
	d, ok := f.items[id]
	if !ok {
		return nil, nil
	}
	copy := d
	return &copy, nil
}

func (f *fakeDrugs) List(_ context.Context, flt drug.ListFilter) ([]drug.Drug, int64, error) {
	out := make([]drug.Drug, 0, len(f.items))
	for _, d := range f.items {
		if flt.IsControlled != nil && d.IsControlled != *flt.IsControlled {
			continue
		}
		out = append(out, d)
	}
	return out, int64(len(out)), nil
}

type fakeShelf struct {
	bins    map[string]shelf.Bin
	batches map[string]shelf.StockBatch
}

func (f *fakeShelf) ListBins(context.Context) ([]shelf.Bin, error) {
	out := make([]shelf.Bin, 0, len(f.bins))
	for _, b := range f.bins {
		out = append(out, b)
	}
	return out, nil
}

func (f *fakeShelf) GetBin(_ context.Context, id string) (*shelf.Bin, error) {
	b, ok := f.bins[id]
	if !ok {
		return nil, nil
	}
	copy := b
	return &copy, nil
}

func (f *fakeShelf) BatchesByDrug(_ context.Context, drugID string) ([]shelf.StockBatch, error) {
	var out []shelf.StockBatch
	for _, b := range f.batches {
		if b.DrugID == drugID {
			out = append(out, b)
		}
	}
	return out, nil
}

func (f *fakeShelf) AllBatches(context.Context) ([]shelf.StockBatch, error) {
	out := make([]shelf.StockBatch, 0, len(f.batches))
	for _, b := range f.batches {
		out = append(out, b)
	}
	return out, nil
}

func (f *fakeShelf) GetBatch(_ context.Context, id string) (*shelf.StockBatch, error) {
	b, ok := f.batches[id]
	if !ok {
		return nil, nil
	}
	copy := b
	return &copy, nil
}

func (f *fakeShelf) InsertBatch(_ context.Context, b shelf.StockBatch) error {
	f.batches[b.ID] = b
	return nil
}

func (f *fakeShelf) DeleteBatch(_ context.Context, id string) error {
	delete(f.batches, id)
	return nil
}

func (f *fakeShelf) UpdateBatchQuantity(_ context.Context, id string, quantity int) error {
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

func (f *fakeShelf) UpdateBatchStatus(_ context.Context, id, status string) error {
	b, ok := f.batches[id]
	if !ok {
		return nil
	}
	b.Status = status
	f.batches[id] = b
	return nil
}

type fakeCardex struct {
	items []cardex.Movement
}

func (f *fakeCardex) Append(_ context.Context, in cardex.AppendInput) (cardex.Movement, error) {
	m := cardex.Movement{
		ID:      "mov-" + in.BatchNo,
		DrugID:  in.DrugID,
		Type:    in.Type,
		BatchNo: in.BatchNo,
		QtyIn:   in.QtyIn,
		QtyOut:  in.QtyOut,
	}
	f.items = append(f.items, m)
	return m, nil
}

func (f *fakeCardex) Delete(_ context.Context, id string) error {
	filtered := f.items[:0]
	for _, m := range f.items {
		if m.ID != id {
			filtered = append(filtered, m)
		}
	}
	f.items = filtered
	return nil
}

type fakeAudit struct {
	events []audit.AppendInput
}

func (f *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	f.events = append(f.events, in)
	return audit.Event{ID: "aud-1"}, nil
}

func newTestFixture() (*Service, *fakeLedgerRepo, *fakeShelf, *fakeCardex, *fakeAudit) {
	repo := &fakeLedgerRepo{}
	drugs := &fakeDrugs{items: map[string]drug.Drug{
		"drug-morphine": {
			ID: "drug-morphine", NameFa: "مورفین سولفات", DosageForm: "آمپول", Strength: "10mg/ml",
			Manufacturer: "داروپخش", UnitLabel: "آمپول", IsControlled: true, ReorderLevel: 10,
		},
		"drug-amox": {
			ID: "drug-amox", NameFa: "آموکسی‌سیلین", DosageForm: "کپسول", Strength: "500mg",
			UnitLabel: "عدد", IsControlled: false,
		},
	}}
	stock := &fakeShelf{
		bins: map[string]shelf.Bin{
			"bin-s010101": {ID: "bin-s010101", Zone: "S", Address: "S-01-1-01", IsControlled: true, MacroLocation: "controlled"},
			"bin-a01":     {ID: "bin-a01", Zone: "A", Address: "A-01-1-01", IsControlled: false, MacroLocation: "main"},
		},
		batches: map[string]shelf.StockBatch{
			"batch-mor-1": {
				ID: "batch-mor-1", DrugID: "drug-morphine", BinID: "bin-s010101",
				NameFa: "مورفین سولفات", BatchNo: "MR-09", Expiry: "2027-03-01",
				Quantity: 12, Status: "active", Zone: "S", LocationLabel: "S-01-1-01", IsControlled: true,
			},
		},
	}
	cx := &fakeCardex{}
	au := &fakeAudit{}
	svc := NewService(repo, drugs, stock, cx, au)
	svc.now = func() time.Time { return time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC) }
	return svc, repo, stock, cx, au
}

func testActor() requestctx.Actor {
	return requestctx.Actor{
		UserID:   "user-operator",
		Name:     "دکتر رضایی",
		Role:     "technical_officer",
		Initials: "در",
		BranchID: "branch-central",
	}
}

func TestRegisterValidation(t *testing.T) {
	svc, _, _, _, _ := newTestFixture()
	ctx := context.Background()

	tests := []struct {
		name string
		req  CreateRequest
		want string
	}{
		{
			name: "missing required fields",
			req:  CreateRequest{TxType: TxOutPrescription},
			want: "drugId",
		},
		{
			name: "non controlled drug rejected",
			req: CreateRequest{
				DrugID: "drug-amox", TxType: TxOutPrescription, Quantity: 1, BatchNo: "AX-1",
				PhysicianName: "دکتر احمدی", PatientNationalID: "0071234583", TrackingCode: "TTAC-1", TechnicalAck: true,
			},
			want: "drugId",
		},
		{
			name: "invalid national id",
			req: CreateRequest{
				DrugID: "drug-morphine", TxType: TxOutPrescription, Quantity: 1, BatchNo: "MR-09",
				PhysicianName: "دکتر احمدی", PatientNationalID: "12345", TrackingCode: "TTAC-1", TechnicalAck: true,
			},
			want: "patientNationalId",
		},
		{
			name: "non vault bin rejected for inflow",
			req: CreateRequest{
				DrugID: "drug-morphine", TxType: TxInDistributor, Quantity: 5, BatchNo: "MR-10",
				Expiry: "2028-01-01", BinID: "bin-a01", PhysicianName: "داروپخش", TrackingCode: "TTAC-2", TechnicalAck: true,
			},
			want: "binId",
		},
		{
			name: "insufficient batch stock",
			req: CreateRequest{
				DrugID: "drug-morphine", TxType: TxOutPrescription, Quantity: 20, BatchNo: "MR-09",
				PhysicianName: "دکتر صابری", PatientNationalID: "0071234583", TrackingCode: "TTAC-3", TechnicalAck: true,
			},
			want: "quantity",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.Register(ctx, tc.req, testActor(), "127.0.0.1")
			var app *errormap.AppError
			if !errors.As(err, &app) {
				t.Fatalf("expected AppError, got %v", err)
			}
			fields, ok := app.Fields.(map[string]string)
			if !ok {
				t.Fatalf("expected map[string]string fields, got %T", app.Fields)
			}
			if _, exists := fields[tc.want]; !exists {
				t.Fatalf("expected field error %q, got %v", tc.want, fields)
			}
		})
	}
}

func TestRegisterOutflowAndInflowAndWaste(t *testing.T) {
	svc, repo, stock, cx, au := newTestFixture()
	ctx := context.Background()

	// 1. Outflow prescription (with Persian digits in national ID to verify normalization)
	outDTO, err := svc.Register(ctx, CreateRequest{
		DrugID:            "drug-morphine",
		TxType:            TxOutPrescription,
		Quantity:          4,
		BatchNo:           "MR-09",
		PhysicianName:     "دکتر صابری",
		PhysicianLicense:  "م-۴۸۹۲۱",
		PatientNationalID: "۰۰۷۱۲۳۴۵۸۳",
		TrackingCode:      "TTAC-884920",
		SepasCode:         "۱۸۰۴۹۲۸",
		TechnicalAck:      true,
	}, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("outflow failed: %v", err)
	}
	if outDTO.SeqNo != 1 || outDTO.QtyOut != 4 || outDTO.BalanceAfter != 8 {
		t.Fatalf("unexpected outflow DTO: %+v", outDTO)
	}
	if outDTO.PatientNationalIDMasked != "007****583" {
		t.Fatalf("expected masked national ID 007****583, got %q", outDTO.PatientNationalIDMasked)
	}
	if stock.batches["batch-mor-1"].Quantity != 8 {
		t.Fatalf("expected batch quantity 8, got %d", stock.batches["batch-mor-1"].Quantity)
	}

	// 2. Inflow distributor to existing batch
	inDTO, err := svc.Register(ctx, CreateRequest{
		DrugID:        "drug-morphine",
		TxType:        TxInDistributor,
		Quantity:      10,
		BatchNo:       "MR-09",
		Expiry:        "2027-03-01",
		BinID:         "bin-s010101",
		PhysicianName: "پخش رازی",
		TrackingCode:  "TTAC-IN-99",
		TechnicalAck:  true,
	}, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("inflow failed: %v", err)
	}
	if inDTO.SeqNo != 2 || inDTO.QtyIn != 10 || inDTO.BalanceAfter != 18 {
		t.Fatalf("unexpected inflow DTO: %+v", inDTO)
	}
	if stock.batches["batch-mor-1"].Quantity != 18 {
		t.Fatalf("expected batch quantity 18, got %d", stock.batches["batch-mor-1"].Quantity)
	}

	// 3. Waste return (used ampoule — does not change active vault stock)
	wasteUsed, err := svc.Register(ctx, CreateRequest{
		DrugID:        "drug-morphine",
		TxType:        TxWasteReturn,
		WasteMode:     WasteModeUsedAmpoule,
		Quantity:      4,
		BatchNo:       "MR-09",
		PhysicianName: "دکتر صابری",
		TrackingCode:  "TTAC-WASTE-1",
		TechnicalAck:  true,
	}, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("waste used ampoule failed: %v", err)
	}
	if wasteUsed.AmpouleWasteCount != 4 || wasteUsed.QtyOut != 0 || wasteUsed.BalanceAfter != 18 {
		t.Fatalf("unexpected waste used DTO: %+v", wasteUsed)
	}

	// 4. Waste return (damaged stock — deducts vault stock)
	wasteDamaged, err := svc.Register(ctx, CreateRequest{
		DrugID:       "drug-morphine",
		TxType:       TxWasteReturn,
		WasteMode:    WasteModeDamagedStock,
		Quantity:     3,
		BatchNo:      "MR-09",
		TrackingCode: "TTAC-WASTE-2",
		TechnicalAck: true,
	}, testActor(), "127.0.0.1")
	if err != nil {
		t.Fatalf("waste damaged stock failed: %v", err)
	}
	if wasteDamaged.QtyOut != 3 || wasteDamaged.AmpouleWasteCount != 3 || wasteDamaged.BalanceAfter != 15 {
		t.Fatalf("unexpected waste damaged DTO: %+v", wasteDamaged)
	}

	if len(repo.entries) != 4 || len(cx.items) != 4 || len(au.events) != 4 {
		t.Fatalf("expected 4 entries/cardex/audit, got %d/%d/%d", len(repo.entries), len(cx.items), len(au.events))
	}
	if au.events[0].Action != "controlled_dispense" || au.events[0].EntityType != "narcotic_book" || !au.events[0].IsControlledSubstance {
		t.Fatalf("unexpected audit event: %+v", au.events[0])
	}

	// 5. List & Export
	listRes, err := svc.List(ctx, ListQuery{Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if listRes.Total != 4 || listRes.KPIs.TotalVaultBalance != 15 || listRes.KPIs.WasteDestroyedCount != 7 {
		t.Fatalf("unexpected list KPIs: %+v", listRes.KPIs)
	}

	csvBytes, ct, err := svc.Export(ctx, ListQuery{Page: 1, PageSize: 25}, "csv")
	if err != nil {
		t.Fatalf("export csv failed: %v", err)
	}
	if !strings.Contains(ct, "text/csv") || !strings.Contains(string(csvBytes), "TTAC-884920") {
		t.Fatalf("unexpected csv export: ct=%s body=%s", ct, string(csvBytes))
	}
}

func TestRegisterRollbackOnInsertFailure(t *testing.T) {
	svc, repo, stock, cx, _ := newTestFixture()
	repo.insertErr = errors.New("db write error")
	ctx := context.Background()

	_, err := svc.Register(ctx, CreateRequest{
		DrugID:            "drug-morphine",
		TxType:            TxOutPrescription,
		Quantity:          12,
		BatchNo:           "MR-09",
		PhysicianName:     "دکتر صابری",
		PatientNationalID: "0071234583",
		TrackingCode:      "TTAC-FAIL",
		TechnicalAck:      true,
	}, testActor(), "127.0.0.1")
	if err == nil {
		t.Fatal("expected error when repo insert fails")
	}
	if stock.batches["batch-mor-1"].Quantity != 12 || stock.batches["batch-mor-1"].Status != "active" {
		t.Fatalf("expected batch rollback to qty=12 active, got %+v", stock.batches["batch-mor-1"])
	}
	if len(cx.items) != 0 {
		t.Fatalf("expected cardex rollback, got %d items", len(cx.items))
	}
}

func TestCrossModuleHooks(t *testing.T) {
	svc, repo, _, _, _ := newTestFixture()
	ctx := context.Background()

	if err := svc.RecordFromDispensing(ctx, DispenseHookInput{
		OrderID: "ord-1", OrderNo: "OUT-00001", DrugID: "drug-morphine", DrugNameFa: "مورفین سولفات",
		UnitLabel: "آمپول", Quantity: 2, BatchID: "batch-mor-1", BatchNo: "MR-09", Expiry: "2027-03-01",
		LocationLabel: "S-01-1-01", PhysicianName: "دکتر کریمی", RecipientNationalID: "0012345678",
		ERxTrackingID: "ERX-1", TechnicalAck: true, Actor: testActor(),
	}); err != nil {
		t.Fatalf("RecordFromDispensing failed: %v", err)
	}
	if err := svc.RecordFromReceipt(ctx, ReceiptHookInput{
		ReceiptID: "rec-1", InvoiceNo: "INV-99", Distributor: "داروپخش", DrugID: "drug-morphine",
		DrugNameFa: "مورفین سولفات", UnitLabel: "آمپول", Quantity: 5, BatchID: "batch-mor-2",
		BatchNo: "MR-10", Expiry: "2028-01-01", LocationLabel: "S-01-1-01", Actor: testActor(),
	}); err != nil {
		t.Fatalf("RecordFromReceipt failed: %v", err)
	}
	listRes, err := svc.List(ctx, ListQuery{Page: pagination.Params{Page: 1}.Page, PageSize: 25})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(repo.entries) != 2 || listRes.Total != 2 {
		t.Fatalf("expected 2 entries from hooks, got %d", len(repo.entries))
	}
}
