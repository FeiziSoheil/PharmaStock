package ttac

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientByIRCOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/irfdamobile/v1/getnfisearchbyirc" {
			t.Fatalf("path %s", r.URL.Path)
		}
		if r.URL.Query().Get("irc") != "5281752637952018" {
			t.Fatalf("query %s", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(`{"succeeded":true,"data":{"drugLicense":{"faBrandName":"آزارام","enBrandName":"AZARAM","gtin":"06260166801277","irc":"5281752637952018","producerCompanyName":"رامو فارمین","status":1,"statusStr":"فعال","packageConsumerPrice":6000000,"drugGenericCode":122},"drugIndex":{"atcCode":""},"ircPricing":{"packageConsumerPrice":6000000,"packageCount":100}}}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, 2*time.Second)
	p, err := c.ByIRC(context.Background(), "5281752637952018")
	if err != nil || p.IRC != "5281752637952018" || p.NameFa != "آزارام" {
		t.Fatalf("%+v %v", p, err)
	}
}

func TestClientSearchFiltersPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/irfdamobile/v1/getnfisearch" {
			t.Fatalf("path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"succeeded":true,"data":{"drugLicenses":[{"faBrandName":"آزارام","irc":"1","gtin":"1","status":1,"statusStr":"فعال","drugGenericCode":1},{"faBrandName":"x","irc":"2","gtin":"2","status":2,"statusStr":"غير فعال","drugGenericCode":2}],"count":2}}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, 2*time.Second)
	hits, count, err := c.Search(context.Background(), "آزارام", 1, 10)
	if err != nil || count != 2 || len(hits) != 2 {
		t.Fatalf("%d %+v %v", count, hits, err)
	}
}

type failOnceTransport struct {
	base http.RoundTripper
	n    int
}

func (t *failOnceTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.n++
	if t.n == 1 {
		return nil, errors.New("connection reset")
	}
	if t.base == nil {
		t.base = http.DefaultTransport
	}
	return t.base.RoundTrip(req)
}

func TestGetJSONTransportRetrySucceedsOnSecondAttempt(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"succeeded":true,"data":{"drugLicense":{"irc":"1","faBrandName":"x"}}}`))
	}))
	defer srv.Close()

	c := NewClient(srv.URL, 2*time.Second)
	tr := &failOnceTransport{}
	c.http.Transport = tr

	_, err := c.ByIRC(context.Background(), "1")
	if err != nil {
		t.Fatalf("expected success after retry: %v", err)
	}
	if tr.n != 2 {
		t.Fatalf("RoundTrip calls = %d, want 2", tr.n)
	}
}

func TestClientByIRCNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"succeeded":true,"data":{"drugLicense":{"irc":""}}}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, 2*time.Second)
	_, err := c.ByIRC(context.Background(), "0000000000000000")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("got %v", err)
	}
}
