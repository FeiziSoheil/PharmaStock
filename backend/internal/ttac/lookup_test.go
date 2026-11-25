package ttac

import (
	"context"
	"errors"
	"testing"
	"time"
)

const (
	testIRC  = "6260001000001001"
	testGTIN = "06260166801277"
)

func TestLookupEmptyQuery(t *testing.T) {
	gw := &fakeGateway{byIRC: func(string) (MappedProduct, error) {
		t.Fatal("gateway called for empty query")
		return MappedProduct{}, nil
	}}
	res := Lookup(context.Background(), "  \t", gw, newMemCache(), true, time.Hour, time.Now().UTC())
	if res.Status != StatusError || res.Message != "کد استعلام خالی است" {
		t.Fatalf("got %+v", res)
	}
	if gw.byIRCCalls != 0 || gw.searchCalls != 0 {
		t.Fatalf("network calls byIRC=%d search=%d", gw.byIRCCalls, gw.searchCalls)
	}
}

func TestLookupIRCLiveAndCaches(t *testing.T) {
	now := time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC)
	product := MappedProduct{
		NameFa: "آموکسی‌سیلین", IRC: testIRC, GTIN: "6260001000001",
		GenericCode: "12345", RawStatus: 1, StatusStr: "فعال", PackageConsumerPrice: 45000,
	}
	gw := &fakeGateway{byIRC: func(irc string) (MappedProduct, error) {
		if irc != testIRC {
			t.Fatalf("ByIRC %q", irc)
		}
		return product, nil
	}}
	cache := newMemCache()
	res := Lookup(context.Background(), "  "+testIRC+" ", gw, cache, true, 24*time.Hour, now)
	if res.Status != StatusFound || res.FromCache {
		t.Fatalf("got %+v", res)
	}
	if res.Product != product {
		t.Fatalf("product %+v", res.Product)
	}
	if gw.byIRCCalls != 1 || gw.searchCalls != 0 {
		t.Fatalf("calls byIRC=%d search=%d", gw.byIRCCalls, gw.searchCalls)
	}
	row, err := cache.Get(context.Background(), testIRC, "")
	if err != nil {
		t.Fatal(err)
	}
	if row == nil || row.Product != product || !row.FetchedAt.Equal(now) || row.IRC != testIRC || row.GTIN != product.GTIN || row.GenericCode != "12345" || row.RawStatus != 1 {
		t.Fatalf("cached %+v", row)
	}
}

func TestLookupUsesFreshCacheWithoutNetwork(t *testing.T) {
	now := time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC)
	ttl := 24 * time.Hour
	cached := Cached{
		IRC: testIRC, GTIN: "6260001000001",
		Product:   MappedProduct{NameFa: "از کش", IRC: testIRC},
		FetchedAt: now.Add(-ttl + time.Second),
		RawStatus: 1,
	}
	gw := &fakeGateway{byIRC: func(string) (MappedProduct, error) {
		t.Fatal("fresh cache must not call gateway")
		return MappedProduct{}, nil
	}}
	res := Lookup(context.Background(), testIRC, gw, newMemCache(cached), true, ttl, now)
	if res.Status != StatusFound || !res.FromCache || res.Product.NameFa != "از کش" {
		t.Fatalf("got %+v", res)
	}
	if gw.byIRCCalls != 0 || gw.searchCalls != 0 {
		t.Fatal("network used")
	}
}

func TestLookupFallsBackToStaleCache(t *testing.T) {
	now := time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC)
	ttl := 24 * time.Hour
	cached := Cached{
		IRC:       testIRC,
		Product:   MappedProduct{NameFa: "کهنه", IRC: testIRC, GTIN: "6260001000001"},
		FetchedAt: now.Add(-ttl),
	}
	gw := &fakeGateway{byIRC: func(string) (MappedProduct, error) {
		return MappedProduct{}, errors.New("timeout")
	}}
	res := Lookup(context.Background(), testIRC, gw, newMemCache(cached), true, ttl, now)
	if res.Status != StatusFound || !res.FromCache || res.Product.NameFa != "کهنه" {
		t.Fatalf("got %+v", res)
	}
	if gw.byIRCCalls != 1 {
		t.Fatalf("expected one live attempt, got %d", gw.byIRCCalls)
	}
}

func TestLookupNotFoundIgnoresStaleCache(t *testing.T) {
	now := time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC)
	cached := Cached{
		IRC: testIRC, Product: MappedProduct{NameFa: "کهنه", IRC: testIRC},
		FetchedAt: now.Add(-48 * time.Hour),
	}
	gw := &fakeGateway{byIRC: func(string) (MappedProduct, error) {
		return MappedProduct{}, ErrNotFound
	}}
	res := Lookup(context.Background(), testIRC, gw, newMemCache(cached), true, 24*time.Hour, now)
	if res.Status != StatusNotFound || res.FromCache {
		t.Fatalf("got %+v", res)
	}
}

func TestLookupTransportErrorWithoutCache(t *testing.T) {
	gw := &fakeGateway{byIRC: func(string) (MappedProduct, error) {
		return MappedProduct{}, errors.New("upstream 502")
	}}
	res := Lookup(context.Background(), testIRC, gw, newMemCache(), true, 24*time.Hour, time.Now().UTC())
	if res.Status != StatusError || res.Message != "خطا در استعلام تی‌تک" {
		t.Fatalf("got %+v", res)
	}
}

func TestLookupDisabledCacheOnly(t *testing.T) {
	now := time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC)
	stale := Cached{
		IRC: testIRC, Product: MappedProduct{NameFa: "فقط کش", IRC: testIRC},
		FetchedAt: now.Add(-72 * time.Hour),
	}
	gw := &fakeGateway{byIRC: func(string) (MappedProduct, error) {
		t.Fatal("disabled lookup must not call gateway")
		return MappedProduct{}, nil
	}}
	cache := newMemCache(stale)
	res := Lookup(context.Background(), testIRC, gw, cache, false, 24*time.Hour, now)
	if res.Status != StatusFound || !res.FromCache || res.Product.NameFa != "فقط کش" {
		t.Fatalf("stale disabled: %+v", res)
	}
	miss := Lookup(context.Background(), "5281752637952018", gw, cache, false, 24*time.Hour, now)
	if miss.Status != StatusNotFound {
		t.Fatalf("miss: %+v", miss)
	}
	if gw.byIRCCalls != 0 || gw.searchCalls != 0 {
		t.Fatal("network used")
	}
}

func TestLookupGTINEnrichesByIRC(t *testing.T) {
	now := time.Date(2026, 11, 12, 8, 0, 0, 0, time.UTC)
	enriched := MappedProduct{NameFa: "غنی‌شده", IRC: testIRC, GTIN: testGTIN, ATCCode: "J01CA04", RawStatus: 1}
	gw := &fakeGateway{
		search: func(term string, page, pageSize int) ([]SearchHit, int, error) {
			if term != testGTIN || page != 1 || pageSize != 10 {
				t.Fatalf("search %q %d %d", term, page, pageSize)
			}
			return []SearchHit{
				{IRC: "other", GTIN: "11111111111111", NameFa: "دیگر", Status: 1},
				{IRC: testIRC, GTIN: testGTIN, NameFa: "خلاصه", Status: 2},
			}, 2, nil
		},
		byIRC: func(irc string) (MappedProduct, error) {
			if irc != testIRC {
				t.Fatalf("ByIRC %q", irc)
			}
			return enriched, nil
		},
	}
	cache := newMemCache()
	res := Lookup(context.Background(), testGTIN, gw, cache, true, 24*time.Hour, now)
	if res.Status != StatusFound || res.FromCache || res.Product != enriched {
		t.Fatalf("got %+v", res)
	}
	if gw.searchCalls != 1 || gw.byIRCCalls != 1 {
		t.Fatalf("calls search=%d byIRC=%d", gw.searchCalls, gw.byIRCCalls)
	}
	row, err := cache.Get(context.Background(), "", testGTIN)
	if err != nil || row == nil || row.Product != enriched {
		t.Fatalf("cached %+v %v", row, err)
	}
}

func TestLookupGTINNoMatch(t *testing.T) {
	gw := &fakeGateway{search: func(string, int, int) ([]SearchHit, int, error) {
		return []SearchHit{{IRC: testIRC, GTIN: "99999999999999", Status: 1}}, 1, nil
	}}
	res := Lookup(context.Background(), testGTIN, gw, newMemCache(), true, time.Hour, time.Now().UTC())
	if res.Status != StatusNotFound {
		t.Fatalf("got %+v", res)
	}
	if gw.byIRCCalls != 0 {
		t.Fatal("ByIRC called without an exact GTIN match")
	}
}

func TestLookupTextSingleActive(t *testing.T) {
	enriched := MappedProduct{NameFa: "آزارام", IRC: testIRC, GTIN: testGTIN, StatusStr: "فعال"}
	gw := &fakeGateway{
		search: func(term string, page, pageSize int) ([]SearchHit, int, error) {
			if term != "آزارام" || page != 1 || pageSize != 10 {
				t.Fatalf("search %q %d %d", term, page, pageSize)
			}
			return []SearchHit{
				{IRC: "inactive", GTIN: "1", Status: 2, NameFa: "غیرفعال"},
				{IRC: testIRC, GTIN: testGTIN, Status: 1, NameFa: "آزارام"},
			}, 2, nil
		},
		byIRC: func(irc string) (MappedProduct, error) {
			if irc != testIRC {
				t.Fatalf("ByIRC %q", irc)
			}
			return enriched, nil
		},
	}
	res := Lookup(context.Background(), " آزارام ", gw, newMemCache(), true, time.Hour, time.Now().UTC())
	if res.Status != StatusFound || res.Product != enriched || res.FromCache {
		t.Fatalf("got %+v", res)
	}
}

func TestLookupTextAmbiguous(t *testing.T) {
	gw := &fakeGateway{search: func(string, int, int) ([]SearchHit, int, error) {
		return []SearchHit{
			{IRC: "1", Status: 1},
			{IRC: "2", Status: 1},
		}, 2, nil
	}}
	res := Lookup(context.Background(), "آموکسی", gw, newMemCache(), true, time.Hour, time.Now().UTC())
	if res.Status != StatusNotFound {
		t.Fatalf("got %+v", res)
	}
	if gw.byIRCCalls != 0 {
		t.Fatal("ambiguous text must not enrich")
	}
}

func TestSearchActiveOnly(t *testing.T) {
	gw := &fakeGateway{search: func(term string, page, pageSize int) ([]SearchHit, int, error) {
		if term != "آموکسی" || page != 2 || pageSize != 5 {
			t.Fatalf("search %q %d %d", term, page, pageSize)
		}
		return []SearchHit{
			{IRC: "a", Status: 1, NameFa: "فعال"},
			{IRC: "b", Status: 2, NameFa: "غیرفعال"},
			{IRC: "c", Status: 1, NameFa: "فعال۲"},
		}, 9, nil
	}}
	hits, count, err := Search(context.Background(), "  آموکسی ", 2, 5, false, gw, true)
	if err != nil {
		t.Fatal(err)
	}
	if count != 9 || len(hits) != 2 || hits[0].IRC != "a" || hits[1].IRC != "c" {
		t.Fatalf("hits=%+v count=%d", hits, count)
	}
	all, count, err := Search(context.Background(), "آموکسی", 2, 5, true, gw, true)
	if err != nil {
		t.Fatal(err)
	}
	if count != 9 || len(all) != 3 {
		t.Fatalf("include inactive hits=%d count=%d", len(all), count)
	}
}

func TestSearchDisabledSkipsGateway(t *testing.T) {
	gw := &fakeGateway{search: func(string, int, int) ([]SearchHit, int, error) {
		t.Fatal("disabled search must not call gateway")
		return nil, 0, nil
	}}
	hits, count, err := Search(context.Background(), "آموکسی", 1, 10, false, gw, false)
	if !errors.Is(err, ErrDisabled) {
		t.Fatalf("err=%v", err)
	}
	if hits != nil || count != 0 || gw.searchCalls != 0 {
		t.Fatalf("hits=%v count=%d calls=%d", hits, count, gw.searchCalls)
	}
}

func TestSearchEmptyTerm(t *testing.T) {
	gw := &fakeGateway{}
	_, _, err := Search(context.Background(), "  ", 1, 10, true, gw, true)
	if !errors.Is(err, ErrEmptySearch) {
		t.Fatalf("err=%v", err)
	}
	if gw.searchCalls != 0 {
		t.Fatal("empty term called gateway")
	}
}

type fakeGateway struct {
	byIRC       func(irc string) (MappedProduct, error)
	search      func(term string, page, pageSize int) ([]SearchHit, int, error)
	byIRCCalls  int
	searchCalls int
}

func (f *fakeGateway) ByIRC(_ context.Context, irc string) (MappedProduct, error) {
	f.byIRCCalls++
	if f.byIRC == nil {
		return MappedProduct{}, errors.New("byIRC not stubbed")
	}
	return f.byIRC(irc)
}

func (f *fakeGateway) Search(_ context.Context, term string, page, pageSize int) ([]SearchHit, int, error) {
	f.searchCalls++
	if f.search == nil {
		return nil, 0, errors.New("search not stubbed")
	}
	return f.search(term, page, pageSize)
}

type memCache struct {
	rows []Cached
}

func newMemCache(rows ...Cached) *memCache {
	out := &memCache{}
	out.rows = append(out.rows, rows...)
	return out
}

func (m *memCache) Get(_ context.Context, irc, gtin string) (*Cached, error) {
	for i := range m.rows {
		row := m.rows[i]
		if irc != "" && row.IRC == irc {
			cp := row
			return &cp, nil
		}
		if gtin != "" && row.GTIN == gtin {
			cp := row
			return &cp, nil
		}
	}
	return nil, nil
}

func (m *memCache) Put(_ context.Context, row Cached) error {
	for i := range m.rows {
		if row.IRC != "" && m.rows[i].IRC == row.IRC {
			m.rows[i] = row
			return nil
		}
		if row.IRC == "" && row.GTIN != "" && m.rows[i].GTIN == row.GTIN {
			m.rows[i] = row
			return nil
		}
	}
	m.rows = append(m.rows, row)
	return nil
}
