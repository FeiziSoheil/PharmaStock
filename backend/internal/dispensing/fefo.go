package dispensing

import (
	"strings"
	"time"

	"pharmastock/backend/internal/shelf"
)

func IsColdChainBatch(b shelf.StockBatch) bool {
	if b.Zone == "R" {
		return true
	}
	return strings.TrimSpace(b.StorageNote) != ""
}

func usable(b shelf.StockBatch) bool {
	if b.Quantity <= 0 {
		return false
	}
	if b.Status != "" && b.Status != "active" {
		return false
	}
	if b.Expiry == "" {
		return true
	}
	exp, err := time.Parse("2006-01-02", b.Expiry)
	if err != nil {
		return true
	}
	today, _ := time.Parse("2006-01-02", time.Now().UTC().Format("2006-01-02"))
	return !exp.Before(today)
}

// PickFEFO returns the best outbound batch. When preferDispensing, zone C wins ties.
func PickFEFO(batches []shelf.StockBatch, preferDispensing bool) *shelf.StockBatch {
	var best *shelf.StockBatch
	for i := range batches {
		cand := &batches[i]
		if !usable(*cand) {
			continue
		}
		if best == nil {
			best = cand
			continue
		}
		best = betterFEFO(best, cand, preferDispensing)
	}
	return best
}

func betterFEFO(a, b *shelf.StockBatch, preferDispensing bool) *shelf.StockBatch {
	if a.Expiry != b.Expiry {
		if a.Expiry == "" {
			return b
		}
		if b.Expiry == "" {
			return a
		}
		if b.Expiry < a.Expiry {
			return b
		}
		if a.Expiry < b.Expiry {
			return a
		}
	}
	if preferDispensing {
		aPos, bPos := a.Zone == "C", b.Zone == "C"
		if bPos && !aPos {
			return b
		}
		if aPos && !bPos {
			return a
		}
	}
	if b.Quantity < a.Quantity {
		return b
	}
	return a
}
