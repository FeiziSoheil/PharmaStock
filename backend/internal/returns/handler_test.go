package returns

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
)

func setupHandlerTest() (*echo.Echo, *Handler) {
	now := time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)
	drugs := newFakeDrugStore(
		drug.Drug{ID: "d-amox", NameFa: "آموکسی‌سیلین", DistributorID: "daroupakhsh", GenericCode: "12345", TotalStock: 20},
	)
	shelfStore := newFakeShelfStore(
		shelf.StockBatch{ID: "b1", DrugID: "d-amox", NameFa: "آموکسی‌سیلین", BatchNo: "AX-1", Expiry: "2026-12-01", Quantity: 20, Status: "active", Distributor: "داروپخش", BuyPriceRial: 30000},
	)
	svc := NewService(newFakeReturnRepo(), shelfStore, drugs, &fakeCardex{}, &fakeAudit{})
	svc.now = func() time.Time { return now }
	h := NewHandler(svc)

	e := echo.New()
	e.HTTPErrorHandler = errormap.HTTPErrorHandler
	e.GET("/api/v1/returns/eligible", h.Eligible)
	e.POST("/api/v1/returns", h.Create)
	e.GET("/api/v1/returns", h.List)
	e.GET("/api/v1/returns/:id", h.Get)
	e.POST("/api/v1/returns/:id/confirm", h.Confirm)
	e.POST("/api/v1/returns/:id/settle", h.Settle)
	return e, h
}

func TestHandlerLifecycle(t *testing.T) {
	e, _ := setupHandlerTest()

	// 1. Eligible
	req := httptest.NewRequest(http.MethodGet, "/api/v1/returns/eligible?windowDays=90", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on eligible, got %d: %s", rec.Code, rec.Body.String())
	}
	var elig EligibilityResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &elig); err != nil {
		t.Fatalf("decode eligible: %v", err)
	}
	if len(elig.Groups) != 1 || elig.KPIs.TotalBatches != 1 {
		t.Fatalf("unexpected eligible response: %+v", elig)
	}

	// 2. Create invalid (empty lines -> 422)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/returns", bytes.NewBufferString(`{"lines":[]}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 on empty create, got %d", rec.Code)
	}

	// 3. Create valid -> 201
	req = httptest.NewRequest(http.MethodPost, "/api/v1/returns", bytes.NewBufferString(`{"windowDays":90,"lines":[{"batchId":"b1","quantity":5}]}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create, got %d: %s", rec.Code, rec.Body.String())
	}
	var created ReturnView
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created: %v", err)
	}

	// 4. Confirm -> 200
	req = httptest.NewRequest(http.MethodPost, "/api/v1/returns/"+created.ID+"/confirm", nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on confirm, got %d: %s", rec.Code, rec.Body.String())
	}

	// 5. Re-confirm -> 409
	req = httptest.NewRequest(http.MethodPost, "/api/v1/returns/"+created.ID+"/confirm", nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 on re-confirm, got %d", rec.Code)
	}

	// 6. Settle -> 200
	req = httptest.NewRequest(http.MethodPost, "/api/v1/returns/"+created.ID+"/settle", bytes.NewBufferString(`{"creditNoteNo":"CN-100"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on settle, got %d: %s", rec.Code, rec.Body.String())
	}

	// 7. Get missing -> 404
	req = httptest.NewRequest(http.MethodGet, "/api/v1/returns/nonexistent", nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 on missing id, got %d", rec.Code)
	}
}
