package domain

import (
	"math"
	"time"
)

const (
	CriticalMaxDays = 30
	WarningMaxDays  = 90
	WatchMaxDays    = 180
)

type ExpiryBucket string

const (
	BucketExpired  ExpiryBucket = "expired"
	BucketCritical ExpiryBucket = "critical"
	BucketWarning  ExpiryBucket = "warning"
	BucketWatch    ExpiryBucket = "watch"
	BucketOK       ExpiryBucket = "ok"
)

func DaysUntilExpiry(expiryISO string, today time.Time) (int, bool) {
	target, ok := ParseExpiryDate(expiryISO)
	if !ok {
		return 0, false
	}
	start := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(target.Year(), target.Month(), target.Day(), 0, 0, 0, 0, time.UTC)
	days := int(math.Round(end.Sub(start).Hours() / 24))
	return days, true
}

func ParseExpiryDate(expiryISO string) (time.Time, bool) {
	if len(expiryISO) >= 10 {
		if t, err := time.Parse("2006-01-02", expiryISO[:10]); err == nil {
			return t.UTC(), true
		}
	}
	t, err := time.Parse(time.RFC3339, expiryISO)
	if err != nil {
		return time.Time{}, false
	}
	return t.UTC(), true
}

func GetExpiryBucket(expiryISO string, today time.Time) (ExpiryBucket, bool) {
	days, ok := DaysUntilExpiry(expiryISO, today)
	if !ok {
		return "", false
	}
	switch {
	case days < 0:
		return BucketExpired, true
	case days <= CriticalMaxDays:
		return BucketCritical, true
	case days <= WarningMaxDays:
		return BucketWarning, true
	case days <= WatchMaxDays:
		return BucketWatch, true
	default:
		return BucketOK, true
	}
}

type ExpiryBatchLike struct {
	Quantity int
	Expiry   string
}

func SumUsableQuantity(batches []ExpiryBatchLike, today time.Time) int {
	sum := 0
	for _, b := range batches {
		bucket, ok := GetExpiryBucket(b.Expiry, today)
		if !ok || bucket == BucketExpired {
			continue
		}
		if b.Quantity > 0 {
			sum += b.Quantity
		}
	}
	return sum
}

type FefoListItem struct {
	DrugID    string
	BatchID   string
	ExpiryISO string
}

type FefoViolation struct {
	DrugID        string `json:"drugId"`
	AheadBatchID  string `json:"aheadBatchId"`
	BehindBatchID string `json:"behindBatchId"`
}

func FindFefoViolations(list []FefoListItem) []FefoViolation {
	var out []FefoViolation
	for i := 0; i < len(list); i++ {
		ahead := list[i]
		for j := i + 1; j < len(list); j++ {
			behind := list[j]
			if ahead.DrugID != behind.DrugID {
				continue
			}
			if ahead.ExpiryISO > behind.ExpiryISO {
				out = append(out, FefoViolation{
					DrugID:        ahead.DrugID,
					AheadBatchID:  ahead.BatchID,
					BehindBatchID: behind.BatchID,
				})
			}
		}
	}
	return out
}
