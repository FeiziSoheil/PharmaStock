package ttac

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrNotFound = errors.New("ttac: not found")

type Client struct {
	base string
	http *http.Client
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	return &Client{
		base: strings.TrimRight(baseURL, "/"),
		http: &http.Client{Timeout: timeout},
	}
}

func (c *Client) ByIRC(ctx context.Context, irc string) (MappedProduct, error) {
	u := c.base + "/irfdamobile/v1/getnfisearchbyirc?irc=" + url.QueryEscape(irc)
	var env envelope[byIRCData]
	if err := c.getJSON(ctx, u, &env); err != nil {
		return MappedProduct{}, err
	}
	if !env.Succeeded || strings.TrimSpace(env.Data.DrugLicense.IRC) == "" {
		return MappedProduct{}, ErrNotFound
	}
	p := MapLicense(env.Data.DrugLicense, &env.Data.DrugIndex)
	if env.Data.IRCPricing.PackageConsumerPrice > 0 {
		p.PackageConsumerPrice = env.Data.IRCPricing.PackageConsumerPrice
	}
	return p, nil
}

func (c *Client) Search(ctx context.Context, term string, page, pageSize int) ([]SearchHit, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	q := url.Values{}
	q.Set("Term", term)
	q.Set("PageNumber", strconv.Itoa(page))
	q.Set("PageSize", strconv.Itoa(pageSize))
	q.Set("IP", "")
	u := c.base + "/irfdamobile/v1/getnfisearch?" + q.Encode()
	var env envelope[searchData]
	if err := c.getJSON(ctx, u, &env); err != nil {
		return nil, 0, err
	}
	if !env.Succeeded {
		return nil, 0, ErrNotFound
	}
	hits := make([]SearchHit, 0, len(env.Data.DrugLicenses))
	for _, lic := range env.Data.DrugLicenses {
		hits = append(hits, MapSearchItem(lic))
	}
	return hits, env.Data.Count, nil
}

func (c *Client) getJSON(ctx context.Context, rawURL string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		if res != nil {
			res.Body.Close()
		}
		res, err = c.http.Do(req)
		if err != nil {
			return err
		}
	}
	defer res.Body.Close()
	if res.StatusCode >= 500 {
		return fmt.Errorf("ttac: upstream %d", res.StatusCode)
	}
	if res.StatusCode >= 400 {
		return ErrNotFound
	}
	return json.NewDecoder(res.Body).Decode(dest)
}
