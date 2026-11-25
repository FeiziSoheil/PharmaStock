package drug

import (
	"context"
	"errors"
	"testing"
	"time"

	"pharmastock/backend/internal/ttac"
)

func TestLookupTTACMapsLiveProduct(t *testing.T) {
	const irc = "6260001000001001"
	gw := &stubGateway{product: ttac.MappedProduct{
		NameFa: "آموکسی‌سیلین", BrandName: "Amoxil", IRC: irc, GTIN: "6260001000001",
		GenericCode: "12345", Manufacturer: "فارابی", ATCCode: "J01CA04",
		StatusStr: "فعال", PackageConsumerPrice: 45000, RawStatus: 1,
	}}
	svc := NewService(nil, nil, gw, true, 24*time.Hour)
	got := svc.LookupTTAC(context.Background(), " "+irc+" ")
	if got["status"] != "found" {
		t.Fatalf("status: %#v", got)
	}
	p, ok := got["product"].(TtacProduct)
	if !ok {
		t.Fatalf("product type %T", got["product"])
	}
	if p.NameFa != "آموکسی‌سیلین" || p.IRC != irc || p.GTIN != "6260001000001" || p.GenericCode != "12345" || p.ATCCode != "J01CA04" || p.StatusStr != "فعال" || p.PackageConsumerPrice != 45000 || p.FromCache {
		t.Fatalf("%+v", p)
	}
	if gw.byIRCCalls != 1 {
		t.Fatalf("ByIRC calls %d", gw.byIRCCalls)
	}
}

func TestLookupTTACEmptyAndNotFound(t *testing.T) {
	gw := &stubGateway{err: ttac.ErrNotFound}
	svc := NewService(nil, nil, gw, true, time.Hour)
	empty := svc.LookupTTAC(context.Background(), " ")
	if empty["status"] != "error" || empty["message"] != "کد استعلام خالی است" {
		t.Fatalf("empty: %#v", empty)
	}
	miss := svc.LookupTTAC(context.Background(), "5281752637952018")
	if miss["status"] != "not_found" {
		t.Fatalf("miss: %#v", miss)
	}
	if _, ok := miss["product"]; ok {
		t.Fatal("not_found included product")
	}
}

func TestSearchTTACActiveOnly(t *testing.T) {
	gw := &stubGateway{hits: []ttac.SearchHit{
		{IRC: "a", Status: 1, NameFa: "فعال"},
		{IRC: "b", Status: 2, NameFa: "غیرفعال"},
	}, count: 4}
	svc := NewService(nil, nil, gw, true, time.Hour)
	items, count, err := svc.SearchTTAC(context.Background(), " آموکسی ", 1, 10, false)
	if err != nil {
		t.Fatal(err)
	}
	if count != 4 || len(items) != 1 || items[0].IRC != "a" {
		t.Fatalf("items=%+v count=%d", items, count)
	}
	if gw.searchCalls != 1 || gw.lastTerm != "آموکسی" || gw.lastPage != 1 || gw.lastSize != 10 {
		t.Fatalf("gateway %+v", gw)
	}

	svcDisabled := NewService(nil, nil, gw, false, time.Hour)
	_, _, err = svcDisabled.SearchTTAC(context.Background(), "آموکسی", 1, 10, true)
	if !errors.Is(err, ttac.ErrDisabled) {
		t.Fatalf("disabled err=%v", err)
	}
}

type stubGateway struct {
	product     ttac.MappedProduct
	err         error
	hits        []ttac.SearchHit
	count       int
	byIRCCalls  int
	searchCalls int
	lastTerm    string
	lastPage    int
	lastSize    int
}

func (s *stubGateway) ByIRC(context.Context, string) (ttac.MappedProduct, error) {
	s.byIRCCalls++
	if s.err != nil {
		return ttac.MappedProduct{}, s.err
	}
	return s.product, nil
}

func (s *stubGateway) Search(_ context.Context, term string, page, pageSize int) ([]ttac.SearchHit, int, error) {
	s.searchCalls++
	s.lastTerm = term
	s.lastPage = page
	s.lastSize = pageSize
	if s.err != nil && s.hits == nil {
		return nil, 0, s.err
	}
	return s.hits, s.count, nil
}
