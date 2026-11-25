package ttac

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"
)

const (
	StatusFound    = "found"
	StatusNotFound = "not_found"
	StatusError    = "error"
)

var (
	ErrDisabled    = errors.New("تی‌تک غیرفعال است")
	ErrEmptySearch = errors.New("عبارت جستجو خالی است")
)

// Cached is one ttac_cache row as the orchestrator sees it.
type Cached struct {
	IRC         string
	GTIN        string
	GenericCode string
	Product     MappedProduct
	FetchedAt   time.Time
	RawStatus   int
}

// CacheStore is the fresh/stale license cache. Get returns (nil, nil) on miss.
type CacheStore interface {
	Get(ctx context.Context, irc, gtin string) (*Cached, error)
	Put(ctx context.Context, row Cached) error
}

// Result is a lookup outcome. Status is found, not_found, or error.
type Result struct {
	Status    string
	Message   string
	Product   MappedProduct
	FromCache bool
}

// Lookup resolves q from a fresh cache, then the live gateway, then a stale cache.
func Lookup(ctx context.Context, q string, gw Gateway, cache CacheStore, enabled bool, ttl time.Duration, now time.Time) Result {
	q = strings.TrimSpace(q)
	if q == "" {
		return Result{Status: StatusError, Message: "کد استعلام خالی است"}
	}
	kind, n := ClassifyQuery(q)
	row, err := loadCache(ctx, cache, kind, n)
	if err != nil {
		return Result{Status: StatusError, Message: "خطا در استعلام تی‌تک"}
	}
	if fresh(row, now, ttl) {
		return fromCache(row)
	}
	if !enabled {
		if row != nil {
			return fromCache(row)
		}
		return Result{Status: StatusNotFound}
	}
	product, liveErr := fetchLive(ctx, gw, kind, n)
	if liveErr != nil {
		return liveFailure(liveErr, row)
	}
	storeCached(ctx, cache, product, now)
	return Result{Status: StatusFound, Product: product}
}

// Search queries the live gateway and drops inactive licenses unless includeInactive is set.
// count is the upstream total, not the filtered page length.
func Search(ctx context.Context, term string, page, pageSize int, includeInactive bool, gw Gateway, enabled bool) ([]SearchHit, int, error) {
	term = strings.TrimSpace(term)
	if term == "" {
		return nil, 0, ErrEmptySearch
	}
	if !enabled {
		return nil, 0, ErrDisabled
	}
	if gw == nil {
		return nil, 0, errors.New("ttac: no gateway")
	}
	hits, count, err := gw.Search(ctx, term, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	filtered := FilterActive(hits, includeInactive)
	if filtered == nil {
		filtered = []SearchHit{}
	}
	return filtered, count, nil
}

func loadCache(ctx context.Context, cache CacheStore, kind QueryKind, n string) (*Cached, error) {
	if cache == nil || n == "" {
		return nil, nil
	}
	switch kind {
	case QueryIRC:
		return cache.Get(ctx, n, "")
	case QueryGTIN:
		return cache.Get(ctx, "", n)
	default:
		return nil, nil
	}
}

func fresh(row *Cached, now time.Time, ttl time.Duration) bool {
	if row == nil || ttl <= 0 {
		return false
	}
	return now.Sub(row.FetchedAt) < ttl
}

func fromCache(row *Cached) Result {
	return Result{Status: StatusFound, Product: row.Product, FromCache: true}
}

func fetchLive(ctx context.Context, gw Gateway, kind QueryKind, n string) (MappedProduct, error) {
	if gw == nil {
		return MappedProduct{}, errors.New("ttac: no gateway")
	}
	switch kind {
	case QueryIRC:
		return gw.ByIRC(ctx, n)
	case QueryGTIN:
		return lookupGTIN(ctx, gw, n)
	default:
		return lookupText(ctx, gw, n)
	}
}

func lookupGTIN(ctx context.Context, gw Gateway, gtin string) (MappedProduct, error) {
	hits, _, err := gw.Search(ctx, gtin, 1, 10)
	if err != nil {
		return MappedProduct{}, err
	}
	var matched []SearchHit
	for _, h := range hits {
		if h.GTIN == gtin {
			matched = append(matched, h)
		}
	}
	if len(matched) != 1 {
		return MappedProduct{}, ErrNotFound
	}
	if strings.TrimSpace(matched[0].IRC) == "" {
		return productFromHit(matched[0]), nil
	}
	return gw.ByIRC(ctx, matched[0].IRC)
}

func lookupText(ctx context.Context, gw Gateway, term string) (MappedProduct, error) {
	hits, _, err := gw.Search(ctx, term, 1, 10)
	if err != nil {
		return MappedProduct{}, err
	}
	active := FilterActive(hits, false)
	if len(active) != 1 || strings.TrimSpace(active[0].IRC) == "" {
		return MappedProduct{}, ErrNotFound
	}
	return gw.ByIRC(ctx, active[0].IRC)
}

func productFromHit(h SearchHit) MappedProduct {
	return MappedProduct{
		NameFa: h.NameFa, BrandName: h.BrandName, GTIN: h.GTIN, IRC: h.IRC,
		Manufacturer: h.Manufacturer, StatusStr: h.StatusStr,
		PackageConsumerPrice: h.PackageConsumerPrice, RawStatus: h.Status,
	}
}

func liveFailure(err error, row *Cached) Result {
	if errors.Is(err, ErrNotFound) {
		return Result{Status: StatusNotFound}
	}
	if row != nil {
		return fromCache(row)
	}
	return Result{Status: StatusError, Message: "خطا در استعلام تی‌تک"}
}

func storeCached(ctx context.Context, cache CacheStore, product MappedProduct, now time.Time) {
	if cache == nil {
		return
	}
	err := cache.Put(ctx, Cached{
		IRC: product.IRC, GTIN: product.GTIN, GenericCode: product.GenericCode,
		Product: product, FetchedAt: now.UTC(), RawStatus: product.RawStatus,
	})
	if err != nil {
		slog.WarnContext(ctx, "ttac cache put failed", "err", err, "irc", product.IRC, "gtin", product.GTIN)
	}
}
