package dispensing_test

import (
	"testing"

	"pharmastock/backend/internal/dispensing"
	"pharmastock/backend/internal/shelf"
)

func TestPickFEFO_NearestExpiry(t *testing.T) {
	got := dispensing.PickFEFO([]shelf.StockBatch{
		{ID: "later", DrugID: "d1", Quantity: 5, Status: "active", Expiry: "2027-06-01"},
		{ID: "soon", DrugID: "d1", Quantity: 3, Status: "active", Expiry: "2026-12-01"},
	}, true)
	if got == nil || got.ID != "soon" {
		t.Fatalf("got %#v", got)
	}
}

func TestPickFEFO_SkipsZeroAndNonActive(t *testing.T) {
	got := dispensing.PickFEFO([]shelf.StockBatch{
		{ID: "zero", Quantity: 0, Status: "active", Expiry: "2026-01-01"},
		{ID: "quarantine", Quantity: 5, Status: "quarantine", Expiry: "2026-01-01"},
		{ID: "ok", Quantity: 2, Status: "active", Expiry: "2027-06-01"},
	}, true)
	if got == nil || got.ID != "ok" {
		t.Fatalf("got %#v", got)
	}
}

func TestPickFEFO_PreferDispensingZone(t *testing.T) {
	got := dispensing.PickFEFO([]shelf.StockBatch{
		{ID: "main", Quantity: 5, Status: "active", Expiry: "2026-12-01", Zone: "A"},
		{ID: "pos", Quantity: 5, Status: "active", Expiry: "2026-12-01", Zone: "C"},
	}, true)
	if got == nil || got.ID != "pos" {
		t.Fatalf("prefer C zone, got %#v", got)
	}
}
