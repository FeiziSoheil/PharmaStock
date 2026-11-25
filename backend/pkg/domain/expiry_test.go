package domain

import (
	"testing"
	"time"
)

func TestGetExpiryBucket(t *testing.T) {
	today := time.Date(2026, 11, 11, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		expiry string
		want   ExpiryBucket
	}{
		{"2026-11-01", BucketExpired},
		{"2026-11-11", BucketCritical},
		{"2026-12-11", BucketCritical},
		{"2027-01-20", BucketWarning},
		{"2027-04-01", BucketWatch},
		{"2027-12-01", BucketOK},
	}
	for _, tc := range cases {
		got, ok := GetExpiryBucket(tc.expiry, today)
		if !ok {
			t.Fatalf("bucket parse failed for %s", tc.expiry)
		}
		if got != tc.want {
			t.Fatalf("%s: got %s want %s", tc.expiry, got, tc.want)
		}
	}
}

func TestSumUsableQuantityExcludesExpired(t *testing.T) {
	today := time.Date(2026, 11, 11, 0, 0, 0, 0, time.UTC)
	sum := SumUsableQuantity([]ExpiryBatchLike{
		{Quantity: 10, Expiry: "2026-10-01"},
		{Quantity: 5, Expiry: "2027-01-01"},
	}, today)
	if sum != 5 {
		t.Fatalf("got %d want 5", sum)
	}
}

func TestFindFefoViolations(t *testing.T) {
	v := FindFefoViolations([]FefoListItem{
		{DrugID: "d1", BatchID: "b2", ExpiryISO: "2027-06-01"},
		{DrugID: "d1", BatchID: "b1", ExpiryISO: "2027-01-01"},
	})
	if len(v) != 1 {
		t.Fatalf("want 1 violation got %d", len(v))
	}
}
