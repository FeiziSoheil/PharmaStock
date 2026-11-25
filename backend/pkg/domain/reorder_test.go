package domain

import (
	"math"
	"testing"
)

func TestSuggestedQuantity(t *testing.T) {
	q := SuggestedQuantity(ReorderItemInput{
		AvailableStock:  2,
		ReorderPoint:    10,
		TargetStock:     40,
		OnOrderQuantity: 0,
		AvgDailyUsage:   1,
		PackSize:        10,
	})
	if q != 40 {
		t.Fatalf("got %d want 40", q)
	}
}

func TestDaysOfCoverAndUrgency(t *testing.T) {
	d := DaysOfCover(ReorderItemInput{AvailableStock: 4, AvgDailyUsage: 2})
	if d != 2 {
		t.Fatalf("days=%v", d)
	}
	if UrgencyFromDaysOfCover(d) != UrgencyCritical {
		t.Fatalf("urgency")
	}
	inf := DaysOfCover(ReorderItemInput{AvailableStock: 10, AvgDailyUsage: 0})
	if !math.IsInf(inf, 1) {
		t.Fatalf("expected +Inf")
	}
}

func TestResolveROPAndTargetAndConfig(t *testing.T) {
	cfg := DefaultReorderFormulaConfig()
	rop, target := ResolveROPAndTarget(40, 120, 5, 8, cfg)
	if rop != 40 || target != 120 {
		t.Fatalf("drug_defaults got (%d,%d) want (40,120)", rop, target)
	}

	cfg.Mode = FormulaModeDynamicADU
	cfg.SafetyStockDays = 3
	cfg.TargetCoverageDays = 10
	// ADU=8, lead=5, safety=3 => ROP=8*8=64, target=8*(8+10)=144
	rop, target = ResolveROPAndTarget(40, 120, 5, 8, cfg)
	if rop != 64 || target != 144 {
		t.Fatalf("dynamic_adu got (%d,%d) want (64,144)", rop, target)
	}

	cfg.IncludeOnOrder = false
	cfg.RoundToPackSize = false
	q := SuggestedQuantityWithConfig(ReorderItemInput{
		AvailableStock:  10,
		TargetStock:     45,
		OnOrderQuantity: 20,
		PackSize:        10,
	}, cfg)
	if q != 35 {
		t.Fatalf("without onOrder & rounding got %d want 35", q)
	}
}
