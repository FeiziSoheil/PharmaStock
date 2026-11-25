# Live TTAC Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mongo-only TTAC stub with a live read-only client to `newapi.ttac.ir`, cache results, and expose lookup + search for the drug form (and receipt line helpers).

**Architecture:** New `backend/internal/ttac` package owns HTTP client, DTOs, query classification, and mapping. `drug.Service` orchestrates cache → live call → upsert. Frontend keeps `GET /ttac/lookup` shape and adds `GET /ttac/search` for multi-hit picker. No browser calls to TTAC; no bulk sync.

**Tech Stack:** Go + Echo + MongoDB, `net/http` + `httptest`, Next.js App Router, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-ttac-live-lookup-design.md`

## Global Constraints

- App code only under `02-project/app/`.
- Persian main headings; no TTAC calls from the browser.
- No real secrets or committed `.env` (`.env.example` placeholders only).
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or `tools/export-agent-logs.py`.
- Working directories: frontend from `02-project/app`; Go from `02-project/app/backend`.
- Frontend tests: `pnpm test`; Go: `go test ./...`.
- Autofill is suggestion-only; operator confirms apply.
- Default search/list filter: active licenses (`status === 1`).

## File map

| File | Responsibility |
|------|----------------|
| `backend/internal/ttac/classify.go` | Detect IRC / GTIN / text from `q` |
| `backend/internal/ttac/classify_test.go` | Classify unit tests |
| `backend/internal/ttac/map.go` | Map TTAC JSON → `drug.TtacProduct` + search hits |
| `backend/internal/ttac/map_test.go` | Mapper unit tests |
| `backend/internal/ttac/dto.go` | Upstream + mapped DTOs |
| `backend/internal/ttac/client.go` | HTTP client `Search` / `ByIRC` |
| `backend/internal/ttac/client_test.go` | `httptest` tests |
| `backend/internal/ttac/gateway.go` | `Gateway` interface for injection |
| `backend/pkg/config/config.go` | `TTAC_BASE_URL`, `TTAC_TIMEOUT_MS`, `TTAC_ENABLED` |
| `backend/.env.example` | Placeholder TTAC env vars |
| `backend/pkg/database/mongo.go` | Unique sparse index on `ttac_cache.irc` |
| `backend/internal/drug/entity.go` | Extend `TtacProduct` / `TtacCache` |
| `backend/internal/drug/repository.go` | Cache get/upsert by irc/gtin + freshness |
| `backend/internal/drug/service.go` | Live LookupTTAC + SearchTTAC |
| `backend/internal/drug/service_ttac_test.go` | Service tests with fake gateway |
| `backend/internal/drug/handler.go` | Search handler |
| `backend/cmd/api/bootstrap/app.go` | Wire client into drug service |
| `backend/cmd/api/bootstrap/routes.go` | `GET /ttac/search` |
| `backend/internal/seed/seed.go` | Seed cache rows with `irc` + `fetchedAt` |
| `src/lib/types/drugs.ts` | Optional product fields + search hit types |
| `src/lib/api/drugs.ts` | `apiSearchTtac` + tolerate new lookup fields |
| `src/lib/drugs/data-access.ts` | Export `searchTtac` |
| `src/app/drug-catalog/drug-form-drawer.tsx` | Search picker UX |
| `src/lib/receipts/ttac-line.ts` | Map product → receipt line patch |
| `tests/unit/receipts/ttac-line.test.ts` | Receipt helper tests |
| `tests/unit/drugs/ttac-api.test.ts` | Optional TS client shape test |
| `docs/backend/FRONTEND-WIREUP.md` | Document search endpoint |
| `tests/e2e/drug-catalog.spec.ts` | Cache-only lookup path (extend or add) |

---

### Task 1: Classify query + map license (pure Go)

**Files:**
- Create: `backend/internal/ttac/classify.go`
- Create: `backend/internal/ttac/classify_test.go`
- Create: `backend/internal/ttac/dto.go`
- Create: `backend/internal/ttac/map.go`
- Create: `backend/internal/ttac/map_test.go`

**Interfaces:**
- Produces:
  - `type QueryKind int` with `QueryIRC`, `QueryGTIN`, `QueryText`
  - `func ClassifyQuery(q string) (kind QueryKind, normalized string)`
  - `type SearchHit struct { IRC, GTIN, NameFa, BrandName, Manufacturer, StatusStr string; Status int; PackageConsumerPrice int64 }`
  - `type MappedProduct struct { NameFa, BrandName, DosageForm, Strength, GTIN, IRC, GenericCode, Manufacturer, ATCCode, LicenseExpiry, Category, StatusStr string; PackageConsumerPrice int64; RawStatus int }`
  - `func MapLicense(lic LicenseDTO, index *IndexDTO) MappedProduct`
  - `func MapSearchItem(lic LicenseDTO) SearchHit`
  - `func FilterActive(hits []SearchHit, includeInactive bool) []SearchHit`

- [ ] **Step 1: Write failing classify tests**

```go
package ttac

import "testing"

func TestClassifyQuery(t *testing.T) {
	kind, n := ClassifyQuery(" 5281752637952018 ")
	if kind != QueryIRC || n != "5281752637952018" {
		t.Fatalf("irc: %v %q", kind, n)
	}
	kind, n = ClassifyQuery("06260166801277")
	if kind != QueryGTIN || n != "06260166801277" {
		t.Fatalf("gtin: %v %q", kind, n)
	}
	kind, n = ClassifyQuery("آزارام")
	if kind != QueryText || n != "آزارام" {
		t.Fatalf("text: %v %q", kind, n)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd 02-project/app/backend && go test ./internal/ttac/ -run TestClassifyQuery -v`  
Expected: FAIL (package/function undefined)

- [ ] **Step 3: Implement classify + DTOs**

```go
// classify.go
package ttac

import "strings"

type QueryKind int

const (
	QueryText QueryKind = iota
	QueryIRC
	QueryGTIN
)

func ClassifyQuery(q string) (QueryKind, string) {
	n := strings.TrimSpace(q)
	if n == "" {
		return QueryText, ""
	}
	digits := true
	for _, r := range n {
		if r < '0' || r > '9' {
			digits = false
			break
		}
	}
	if !digits {
		return QueryText, n
	}
	switch len(n) {
	case 16:
		return QueryIRC, n
	case 13, 14:
		return QueryGTIN, n
	default:
		return QueryText, n
	}
}
```

```go
// dto.go — minimal fields used by mapper/client
package ttac

type envelope[T any] struct {
	Data      T      `json:"data"`
	Succeeded bool   `json:"succeeded"`
	Message   string `json:"message"`
}

type LicenseDTO struct {
	IndexEnName              string `json:"indexEnName"`
	EnBrandName              string `json:"enBrandName"`
	FaBrandName              string `json:"faBrandName"`
	GTIN                     string `json:"gtin"`
	IRC                      string `json:"irc"`
	ProducerCompanyName      string `json:"producerCompanyName"`
	Status                   int    `json:"status"`
	StatusStr                string `json:"statusStr"`
	PackageConsumerPrice     int64  `json:"packageConsumerPrice"`
	DrugGenericCode          int64  `json:"drugGenericCode"`
}

type IndexDTO struct {
	ATCCode string `json:"atcCode"`
}

type searchData struct {
	DrugLicenses []LicenseDTO `json:"drugLicenses"`
	Count        int          `json:"count"`
}

type byIRCData struct {
	DrugLicense LicenseDTO `json:"drugLicense"`
	DrugIndex   IndexDTO   `json:"drugIndex"`
	IRCPricing  struct {
		PackageConsumerPrice int64 `json:"packageConsumerPrice"`
		PackageCount         int   `json:"packageCount"`
	} `json:"ircPricing"`
}
```

- [ ] **Step 4: Write failing mapper tests + implement map.go**

```go
func TestMapLicenseTrimsAndMapsIRC(t *testing.T) {
	p := MapLicense(LicenseDTO{
		FaBrandName: "آزارام   قرص خوراکی 50 mg  ",
		EnBrandName: "AZARAM   TABLET ORAL 50 mg  ",
		GTIN: "06260166801277", IRC: "5281752637952018",
		ProducerCompanyName: "رامو فارمین", Status: 1, StatusStr: "فعال",
		PackageConsumerPrice: 6000000, DrugGenericCode: 122,
	}, &IndexDTO{ATCCode: ""})
	if p.NameFa != "آزارام   قرص خوراکی 50 mg" || p.IRC != "5281752637952018" || p.GenericCode != "122" {
		t.Fatalf("%+v", p)
	}
	if p.DosageForm != "" || p.Category != "" {
		t.Fatalf("must not invent dosage/category: %+v", p)
	}
}

func TestFilterActive(t *testing.T) {
	in := []SearchHit{{IRC: "1", Status: 1}, {IRC: "2", Status: 2}}
	out := FilterActive(in, false)
	if len(out) != 1 || out[0].IRC != "1" {
		t.Fatalf("%+v", out)
	}
}
```

```go
func MapLicense(lic LicenseDTO, index *IndexDTO) MappedProduct {
	price := lic.PackageConsumerPrice
	atc := ""
	if index != nil {
		atc = strings.TrimSpace(index.ATCCode)
	}
	return MappedProduct{
		NameFa: strings.TrimSpace(lic.FaBrandName),
		BrandName: strings.TrimSpace(lic.EnBrandName),
		GTIN: strings.TrimSpace(lic.GTIN),
		IRC: strings.TrimSpace(lic.IRC),
		GenericCode: strconv.FormatInt(lic.DrugGenericCode, 10),
		Manufacturer: strings.TrimSpace(lic.ProducerCompanyName),
		ATCCode: atc,
		StatusStr: strings.TrimSpace(lic.StatusStr),
		PackageConsumerPrice: price,
		RawStatus: lic.Status,
	}
}

func MapSearchItem(lic LicenseDTO) SearchHit {
	p := MapLicense(lic, nil)
	return SearchHit{
		IRC: p.IRC, GTIN: p.GTIN, NameFa: p.NameFa, BrandName: p.BrandName,
		Manufacturer: p.Manufacturer, Status: lic.Status, StatusStr: p.StatusStr,
		PackageConsumerPrice: p.PackageConsumerPrice,
	}
}

func FilterActive(hits []SearchHit, includeInactive bool) []SearchHit {
	if includeInactive {
		return hits
	}
	out := make([]SearchHit, 0, len(hits))
	for _, h := range hits {
		if h.Status == 1 {
			out = append(out, h)
		}
	}
	return out
}
```

- [ ] **Step 5: Run tests**

Run: `cd 02-project/app/backend && go test ./internal/ttac/ -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/internal/ttac/
git commit -m "$(cat <<'EOF'
feat(ttac): add query classify and license field mapper

EOF
)"
```

---

### Task 2: HTTP client (`Search` / `ByIRC`)

**Files:**
- Create: `backend/internal/ttac/gateway.go`
- Create: `backend/internal/ttac/client.go`
- Create: `backend/internal/ttac/client_test.go`

**Interfaces:**
- Consumes: DTOs from Task 1
- Produces:
  - `type Gateway interface { Search(ctx context.Context, term string, page, pageSize int) (hits []SearchHit, count int, err error); ByIRC(ctx context.Context, irc string) (MappedProduct, error) }`
  - `func NewClient(baseURL string, timeout time.Duration) *Client`
  - Sentinel: `var ErrNotFound = errors.New("ttac: not found")`

- [ ] **Step 1: Write failing httptest tests**

```go
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
```

- [ ] **Step 2: Run to verify fail**

Run: `cd 02-project/app/backend && go test ./internal/ttac/ -run TestClient -v`  
Expected: FAIL (NewClient undefined)

- [ ] **Step 3: Implement client**

```go
// gateway.go
package ttac

import "context"

type Gateway interface {
	Search(ctx context.Context, term string, page, pageSize int) (hits []SearchHit, count int, err error)
	ByIRC(ctx context.Context, irc string) (MappedProduct, error)
}

// client.go
type Client struct {
	base   string
	http   *http.Client
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
		return err
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
```

Include one retry only for transport errors inside `getJSON` (single re-Do), not for 4xx/5xx.

- [ ] **Step 4: Run tests**

Run: `cd 02-project/app/backend && go test ./internal/ttac/ -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/ttac/
git commit -m "$(cat <<'EOF'
feat(ttac): add HTTP client for NFI search and by-IRC

EOF
)"
```

---

### Task 3: Config, entity, cache repo, indexes

**Files:**
- Modify: `backend/pkg/config/config.go`
- Modify: `backend/.env.example`
- Modify: `backend/internal/drug/entity.go`
- Modify: `backend/internal/drug/repository.go`
- Modify: `backend/pkg/database/mongo.go`
- Modify: `backend/internal/seed/seed.go`

**Interfaces:**
- Produces:
  - `Config.TTACBaseURL string`, `TTACTimeout time.Duration`, `TTACEnabled bool`
  - `TtacProduct` fields: `IRC`, `StatusStr`, `PackageConsumerPrice int64`, `FromCache bool` (FromCache json-only ok)
  - `TtacCache` fields: `IRC`, `FetchedAt time.Time`, `RawStatus int`
  - `Repository.GetTTACCache(ctx, irc, gtin string) (*TtacCache, error)`
  - `Repository.UpsertTTACCache(ctx, row TtacCache) error`
  - Cache ID helper: `irc:<irc>` when IRC known else `gtin:<gtin>`

- [ ] **Step 1: Extend config**

```go
// In Config struct:
TTACBaseURL  string
TTACTimeout  time.Duration
TTACEnabled  bool

// In Load():
TTACBaseURL: env("TTAC_BASE_URL", "https://newapi.ttac.ir"),
TTACTimeout: time.Duration(envInt("TTAC_TIMEOUT_MS", 5000)) * time.Millisecond,
TTACEnabled: envBool("TTAC_ENABLED", true),
```

`.env.example` add:

```
TTAC_BASE_URL=https://newapi.ttac.ir
TTAC_TIMEOUT_MS=5000
TTAC_ENABLED=true
```

- [ ] **Step 2: Extend entities**

```go
type TtacProduct struct {
	NameFa               string `bson:"nameFa" json:"nameFa"`
	BrandName            string `bson:"brandName" json:"brandName"`
	DosageForm           string `bson:"dosageForm" json:"dosageForm"`
	Strength             string `bson:"strength" json:"strength"`
	GTIN                 string `bson:"gtin" json:"gtin"`
	IRC                  string `bson:"irc,omitempty" json:"irc,omitempty"`
	GenericCode          string `bson:"genericCode" json:"genericCode"`
	Manufacturer         string `bson:"manufacturer" json:"manufacturer"`
	ATCCode              string `bson:"atcCode" json:"atcCode"`
	LicenseExpiry        string `bson:"licenseExpiry" json:"licenseExpiry"`
	Category             string `bson:"category" json:"category"`
	StatusStr            string `bson:"statusStr,omitempty" json:"statusStr,omitempty"`
	PackageConsumerPrice int64  `bson:"packageConsumerPrice,omitempty" json:"packageConsumerPrice,omitempty"`
	FromCache            bool   `bson:"-" json:"fromCache,omitempty"`
}

type TtacCache struct {
	ID          string      `bson:"_id"`
	IRC         string      `bson:"irc,omitempty"`
	GTIN        string      `bson:"gtin,omitempty"`
	GenericCode string      `bson:"genericCode,omitempty"`
	Product     TtacProduct `bson:"product"`
	FetchedAt   time.Time   `bson:"fetchedAt"`
	RawStatus   int         `bson:"rawStatus,omitempty"`
}
```

- [ ] **Step 3: Repo cache methods**

Replace `LookupTTAC` find-only with:

```go
func (r *Repository) GetTTACCache(ctx context.Context, irc, gtin string) (*TtacCache, error) {
	or := []bson.M{}
	if irc != "" {
		or = append(or, bson.M{"irc": irc})
	}
	if gtin != "" {
		or = append(or, bson.M{"gtin": gtin})
	}
	if len(or) == 0 {
		return nil, nil
	}
	var row TtacCache
	err := r.ttac.FindOne(ctx, bson.M{"$or": or}).Decode(&row)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) UpsertTTACCache(ctx context.Context, row TtacCache) error {
	_, err := r.ttac.UpdateByID(ctx, row.ID, bson.M{"$set": row}, options.Update().SetUpsert(true))
	return err
}
```

Keep a thin `LookupTTAC` wrapper only if tests/seed still call it; otherwise delete and update call sites.

- [ ] **Step 4: Index + seed**

In `mongo.go` ttac_cache indexes add:

```go
{Keys: bson.D{{Key: "irc", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
```

Update seed amox cache to include `IRC`, `FetchedAt: time.Now().UTC()`, and product `IRC`.

- [ ] **Step 5: Compile check**

Run: `cd 02-project/app/backend && go build ./...`  
Expected: success (service still using old LookupTTAC may need temporary shim — if build fails, add deprecated repo method that calls GetTTACCache by gtin/genericCode for one commit window)

- [ ] **Step 6: Commit**

```bash
git add backend/pkg/config/config.go backend/.env.example backend/internal/drug/entity.go backend/internal/drug/repository.go backend/pkg/database/mongo.go backend/internal/seed/seed.go
git commit -m "$(cat <<'EOF'
feat(ttac): extend cache model, config, and indexes for live lookup

EOF
)"
```

---

### Task 4: `drug.Service` live Lookup + Search (TDD with fake gateway)

**Files:**
- Modify: `backend/internal/drug/service.go`
- Create: `backend/internal/drug/service_ttac_test.go`
- Modify: `backend/cmd/api/bootstrap/app.go` (wire later in Task 5 if preferred here)

**Interfaces:**
- Consumes: `ttac.Gateway`, repo cache methods, `Config` flags via constructor
- Produces:
  - `NewService(repo, audit, gw ttac.Gateway, enabled bool, cacheTTL time.Duration) *Service`
  - `LookupTTAC(ctx, q) map[string]any` — same status keys
  - `SearchTTAC(ctx, term string, page, pageSize int, includeInactive bool) (items []ttac.SearchHit, count int, err error)`

Lookup algorithm (exact):

1. Trim `q`; empty → `{status:error, message:"کد استعلام خالی است"}`
2. `kind, n := ttac.ClassifyQuery(q)`
3. Load cache by irc and/or gtin depending on kind; if fresh (`now.Sub(fetchedAt) < cacheTTL`) → found (+ FromCache true)
4. If `!enabled` → if any cache (even stale) return found; else not_found
5. Live:
   - IRC → `gw.ByIRC`
   - GTIN → `gw.Search(n,1,10)` then exact GTIN match; if one match with IRC → `ByIRC` enrich; if none → not_found
   - Text → `gw.Search`; `FilterActive(..., false)`; if len==1 → ByIRC that IRC; else not_found
6. On live success → upsert cache → found
7. On live transport error → stale cache if any → found+FromCache; else `{status:error, message:"خطا در استعلام تی‌تک"}`
8. On `ErrNotFound` → not_found

- [ ] **Step 1: Write failing service tests with fake gateway + fake cache repo**

Prefer a small interface on service for cache ops **or** use real mongo in integration — for unit speed, extract:

```go
type ttacStore interface {
	GetTTACCache(ctx context.Context, irc, gtin string) (*TtacCache, error)
	UpsertTTACCache(ctx context.Context, row TtacCache) error
}
```

If extracting is too invasive, test `Lookup` logic in `internal/ttac` orchestrator package instead — **preferred alternative if drug.Repository is concrete-only:** create `internal/ttac/lookup.go`:

```go
type CacheStore interface {
	Get(ctx context.Context, irc, gtin string) (*Cached, error)
	Put(ctx context.Context, row Cached) error
}

func Lookup(ctx context.Context, q string, gw Gateway, cache CacheStore, enabled bool, ttl time.Duration, now time.Time) Result
func Search(ctx context.Context, term string, page, pageSize int, includeInactive bool, gw Gateway, enabled bool) (hits []SearchHit, count int, err error)
```

Then `drug.Service` becomes a thin adapter over `ttac.Lookup` / `ttac.Search` + repo adapter. **Do this alternative if Step 1 is blocked by concrete Mongo repo** — it matches the spec’s package boundary better.

Write tests against `ttac.Lookup` / `ttac.Search` with fake gw + in-memory cache:

```go
func TestLookupIRCLiveAndCaches(t *testing.T) { /* ... */ }
func TestLookupUsesFreshCacheWithoutNetwork(t *testing.T) { /* ... */ }
func TestLookupFallsBackToStaleCache(t *testing.T) { /* ... */ }
func TestLookupDisabledCacheOnly(t *testing.T) { /* ... */ }
func TestSearchActiveOnly(t *testing.T) { /* ... */ }
```

- [ ] **Step 2: Run fail → implement orchestrator → pass**

Run: `cd 02-project/app/backend && go test ./internal/ttac/ -v`  
Expected: PASS

- [ ] **Step 3: Wire drug.Service to call orchestrator**

```go
func (s *Service) LookupTTAC(ctx context.Context, q string) map[string]any {
	res := ttac.Lookup(ctx, q, s.ttac, repoCacheAdapter{s.repo}, s.ttacEnabled, s.ttacTTL, time.Now().UTC())
	// map res → status payload; convert MappedProduct → drug.TtacProduct
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/ttac/ backend/internal/drug/
git commit -m "$(cat <<'EOF'
feat(ttac): orchestrate live lookup/search with cache fallback

EOF
)"
```

---

### Task 5: HTTP handlers + bootstrap wiring

**Files:**
- Modify: `backend/internal/drug/handler.go`
- Modify: `backend/cmd/api/bootstrap/routes.go`
- Modify: `backend/cmd/api/bootstrap/app.go`

**Interfaces:**
- Produces: `GET /api/v1/ttac/search?term=&page=&pageSize=&includeInactive=`
- Consumes: `Service.SearchTTAC`, existing `LookupTTAC`

- [ ] **Step 1: Add handler**

```go
func (h *Handler) SearchTTAC(c echo.Context) error {
	term := strings.TrimSpace(c.QueryParam("term"))
	if term == "" {
		return c.JSON(http.StatusOK, map[string]any{
			"items": []any{}, "count": 0, "error": "عبارت جستجو خالی است",
		})
		// Prefer errormap.Validation if that is the project norm for empty input:
		// return errormap.Validation("عبارت جستجو خالی است", map[string]string{"term": "الزامی است"})
	}
	page, _ := strconv.Atoi(c.QueryParam("page"))
	size, _ := strconv.Atoi(c.QueryParam("pageSize"))
	includeInactive := c.QueryParam("includeInactive") == "true" || c.QueryParam("includeInactive") == "1"
	items, count, err := h.svc.SearchTTAC(c.Request().Context(), term, page, size, includeInactive)
	if err != nil {
		return c.JSON(http.StatusOK, map[string]any{
			"items": []any{}, "count": 0, "error": "خطا در استعلام تی‌تک",
		})
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items, "count": count})
}
```

Use `errormap.Validation` for empty `term` if other handlers do so for required query params; otherwise JSON-with-error field is acceptable only if frontend documents it — **prefer Validation → 400** to match drug create.

- [ ] **Step 2: Register route**

```go
secured.GET("/ttac/lookup", r.Drug.LookupTTAC)
secured.GET("/ttac/search", r.Drug.SearchTTAC)
```

- [ ] **Step 3: Wire in `app.go`**

```go
ttacClient := ttac.NewClient(cfg.TTACBaseURL, cfg.TTACTimeout)
drugSvc := drug.NewService(drugRepo, auditSvc, ttacClient, cfg.TTACEnabled, 24*time.Hour)
```

Update `NewService` signature; fix any compile breaks in tests/seed callers.

- [ ] **Step 4: Manual smoke (optional if network allowed)**

```bash
# with API running and JWT:
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/v1/ttac/search?term=%D8%A2%D8%B2%D8%A7%D8%B1%D8%A7%D9%85'
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/v1/ttac/lookup?q=5281752637952018'
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/drug/handler.go backend/cmd/api/bootstrap/routes.go backend/cmd/api/bootstrap/app.go backend/internal/drug/service.go
git commit -m "$(cat <<'EOF'
feat(api): expose TTAC search and wire live client

EOF
)"
```

---

### Task 6: Frontend types + API client

**Files:**
- Modify: `src/lib/types/drugs.ts`
- Modify: `src/lib/api/drugs.ts`
- Modify: `src/lib/drugs/data-access.ts`
- Create: `tests/unit/drugs/ttac-api.test.ts` (mock `apiRequest` only if easy; else type-level compile is enough — prefer a small pure mapper test instead)

**Interfaces:**
- Produces:
  - `TtacProduct` optional: `irc?`, `statusStr?`, `packageConsumerPrice?`, `fromCache?`
  - `TtacSearchHit` type
  - `apiSearchTtac(term, opts?): Promise<{ items: TtacSearchHit[]; count: number }>`
  - `searchTtac` in data-access

- [ ] **Step 1: Extend types**

```ts
export type TtacProduct = {
  nameFa: string
  brandName: string
  dosageForm: DosageForm | ''
  strength: string
  gtin: string
  genericCode: string
  manufacturer: string
  atcCode: string
  licenseExpiry: string
  category: DrugCategory | ''
  irc?: string
  statusStr?: string
  packageConsumerPrice?: number
  fromCache?: boolean
}

export type TtacSearchHit = {
  irc: string
  gtin: string
  nameFa: string
  brandName: string
  manufacturer: string
  status: number
  statusStr: string
  packageConsumerPrice?: number
}
```

Note: `dosageForm`/`category` may be empty string from API — update `productToForm` to skip empty enum fields.

- [ ] **Step 2: Add `apiSearchTtac`**

```ts
export async function apiSearchTtac(
  term: string,
  opts?: { page?: number; pageSize?: number; includeInactive?: boolean },
): Promise<{ items: TtacSearchHit[]; count: number }> {
  const q = term.trim()
  if (!q) return { items: [], count: 0 }
  return apiRequest<{ items: TtacSearchHit[]; count: number }>('/api/v1/ttac/search', {
    query: {
      term: q,
      page: String(opts?.page ?? 1),
      pageSize: String(opts?.pageSize ?? 10),
      ...(opts?.includeInactive ? { includeInactive: 'true' } : {}),
    },
  })
}
```

Export `searchTtac` from data-access mirroring `lookupTtac`.

- [ ] **Step 3: Adjust `productToForm`**

Only assign `dosageForm` / `category` when non-empty and in allowed unions.

- [ ] **Step 4: Run unit tests**

Run: `cd 02-project/app && pnpm test -- tests/unit/drugs tests/unit/receipts 2>/dev/null; pnpm exec tsc --noEmit`  
Expected: typecheck clean; existing drug tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/drugs.ts src/lib/api/drugs.ts src/lib/drugs/data-access.ts src/app/drug-catalog/drug-form-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(drugs): add TTAC search client and optional product fields

EOF
)"
```

---

### Task 7: Drug form search picker UX

**Files:**
- Modify: `src/app/drug-catalog/drug-form-drawer.tsx`

**Interfaces:**
- Consumes: `searchTtac`, `lookupTtac`
- UX flow: type term → Search button → list hits → click hit → `lookupTtac(irc)` → existing found panel → apply

- [ ] **Step 1: State for hits**

```ts
const [hits, setHits] = React.useState<TtacSearchHit[]>([])
```

- [ ] **Step 2: Search handler**

If `Classify`-equivalent on client: digits length 16 or 13–14 → call `lookupTtac` directly; else `searchTtac` and show list.

```ts
async function handleTtacLookup() {
  setTtac({ status: 'loading' })
  setHits([])
  const q = ttacQuery.trim()
  const digitsOnly = /^[0-9]+$/.test(q)
  if (digitsOnly && (q.length === 16 || q.length === 13 || q.length === 14)) {
    const result = await lookupTtac(q)
    setTtac(result)
    return
  }
  try {
    const res = await searchTtac(q)
    setHits(res.items)
    if (res.items.length === 1) {
      const result = await lookupTtac(res.items[0].irc)
      setTtac(result)
      return
    }
    setTtac(res.items.length === 0 ? { status: 'not_found' } : { status: 'idle' })
  } catch {
    setTtac({ status: 'error', message: 'ارتباط با سامانه تیتک برقرار نشد. دوباره تلاش کنید.' })
  }
}
```

- [ ] **Step 3: Render hit list (Persian labels)**

Show `nameFa`, `manufacturer`, `statusStr`, `irc`; on click lookup by IRC. If `statusStr` indicates inactive, disable apply or require extra confirm — for v1: show badge and still allow apply only after explicit button (existing apply already explicit).

- [ ] **Step 4: Manual UI check** with `TTAC_ENABLED=false` + seed: lookup GTIN `6260001000001` still works from cache.

- [ ] **Step 5: Commit**

```bash
git add src/app/drug-catalog/drug-form-drawer.tsx
git commit -m "$(cat <<'EOF'
feat(drug-catalog): TTAC multi-hit search picker in drug form

EOF
)"
```

---

### Task 8: Receipt line helper (UI page not shipped yet)

**Files:**
- Create: `src/lib/receipts/ttac-line.ts`
- Create: `tests/unit/receipts/ttac-line.test.ts`
- Modify: `docs/backend/FRONTEND-WIREUP.md`

**Interfaces:**
- Produces: `ttacProductToLinePatch(product: TtacProduct): Pick<ReceiptLine, 'gtin' | 'irc'> & { nameFa?: string }`
- Note in FRONTEND-WIREUP: when `/invoice-receipts` UI lands, scan desk calls `lookupTtac` then this helper; do not auto-create `drugId`.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { ttacProductToLinePatch } from '@/lib/receipts/ttac-line'
import type { TtacProduct } from '@/lib/types/drugs'

const sample: TtacProduct = {
  nameFa: 'آزارام قرص',
  brandName: 'AZARAM',
  dosageForm: 'قرص',
  strength: '50 mg',
  gtin: '06260166801277',
  genericCode: '122',
  manufacturer: 'رامو فارمین',
  atcCode: '',
  licenseExpiry: '',
  category: 'مسکن و ضدالتهاب',
  irc: '5281752637952018',
}

describe('ttacProductToLinePatch', () => {
  it('maps gtin irc and name', () => {
    expect(ttacProductToLinePatch(sample)).toEqual({
      gtin: '06260166801277',
      irc: '5281752637952018',
      nameFa: 'آزارام قرص',
    })
  })
})
```

- [ ] **Step 2: Implement**

```ts
import type { TtacProduct } from '@/lib/types/drugs'

export function ttacProductToLinePatch(product: TtacProduct): {
  gtin: string
  irc: string
  nameFa: string
} {
  return {
    gtin: product.gtin.trim(),
    irc: (product.irc ?? '').trim(),
    nameFa: product.nameFa.trim(),
  }
}
```

- [ ] **Step 3: Run**

Run: `cd 02-project/app && pnpm test -- tests/unit/receipts/ttac-line.test.ts`  
Expected: PASS

- [ ] **Step 4: Update FRONTEND-WIREUP** — document `GET /ttac/search` and receipt helper note.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receipts/ttac-line.ts tests/unit/receipts/ttac-line.test.ts docs/backend/FRONTEND-WIREUP.md
git commit -m "$(cat <<'EOF'
feat(receipts): add TTAC product → line patch helper

EOF
)"
```

---

### Task 9: E2E smoke (cache-only) + verification

**Files:**
- Modify or create: `tests/e2e/drug-catalog.spec.ts` (only if catalog e2e exists; else skip e2e and document manual checklist)

**Interfaces:**
- Assumes API with `TTAC_ENABLED=false` and seeded `ttac_cache` for amox GTIN.

- [ ] **Step 1: Locate existing drug-catalog e2e; if none, add minimal Playwright:**

```ts
test('TTAC lookup from cache fills preview', async ({ page }) => {
  // login helper as other e2e
  await page.goto('/drug-catalog')
  await page.getByRole('button', { name: /داروی جدید|افزودن/ }).click()
  await page.getByPlaceholder(/GTIN|IRC|بارکد/i).fill('6260001000001')
  await page.getByRole('button', { name: /استعلام/ }).click()
  await expect(page.getByText(/یافته‌شده در سامانه/)).toBeVisible()
})
```

Adjust selectors to match real `data-testid` / labels in `drug-form-drawer.tsx`. Add `data-testid="ttac-query"` and `data-testid="ttac-lookup"` if selectors are fragile.

- [ ] **Step 2: Run Go + unit suites**

```bash
cd 02-project/app/backend && go test ./internal/ttac/ ./internal/drug/ -count=1
cd 02-project/app && pnpm test -- tests/unit/receipts/ttac-line.test.ts
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/ src/app/drug-catalog/drug-form-drawer.tsx
git commit -m "$(cat <<'EOF'
test(ttac): cache-only drug form lookup smoke

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `ttac.Client` Search/ByIRC | 2 |
| Classify IRC/GTIN/text | 1 |
| Mapper; no invented dosage/category | 1 |
| Cache irc+gtin, 24h, stale fallback | 3, 4 |
| `TTAC_*` env + kill switch | 3, 4 |
| Keep `/ttac/lookup` shape | 4, 5 |
| New `/ttac/search` | 5, 6 |
| Active-only default | 1, 4 |
| Drug form picker | 7 |
| Receipt attach gtin/irc (helper; UI later) | 8 |
| No browser→TTAC | 5–7 |
| Tests httptest + unit + e2e/cache | 2, 4, 8, 9 |
| Out of scope bulk sync / write-back | — not planned |

## Placeholder / consistency self-review

- Orchestration lives in `internal/ttac` lookup helpers if `drug.Repository` stays concrete — Task 4 documents this explicitly.
- `TtacProduct.dosageForm` may be `''` — Task 6/7 skip empty enums in `productToForm`.
- Invoice receipts **page** not in repo yet — Task 8 delivers helper + docs only (matches success criteria without blocking on unbuilt wizard UI).
- Empty search `term`: Task 5 prefers `errormap.Validation` (400).
