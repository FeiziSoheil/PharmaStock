package reconciliation

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/requestctx"
)

func setupHandlerEcho(h *Handler) *echo.Echo {
	e := echo.New()
	e.HTTPErrorHandler = errormap.HTTPErrorHandler
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("actor", testActor())
			return next(c)
		}
	})
	e.GET("/api/v1/reconciliations/template", h.Template)
	e.POST("/api/v1/reconciliations/upload", h.Upload)
	e.GET("/api/v1/reconciliations", h.List)
	e.GET("/api/v1/reconciliations/:id", h.Get)
	e.PATCH("/api/v1/reconciliations/:id/mapping", h.UpdateMapping)
	e.POST("/api/v1/reconciliations/:id/confirm", h.Confirm)
	return e
}

func TestHandlerTemplateAndUpload(t *testing.T) {
	batches := &fakeBatches{}
	receipts := &fakeReceipts{}
	auditLog := &fakeAudit{}
	svc, _ := newTestService(batches, receipts, auditLog)
	h := NewHandler(svc)
	e := setupHandlerEcho(h)

	// 1. Download .xlsx template
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reconciliations/template", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET template status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" {
		t.Fatalf("unexpected template content-type: %q", ct)
	}
	xlsxData := rec.Body.Bytes()

	// 2. Upload the downloaded .xlsx back via multipart/form-data
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", "sample.xlsx")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := fw.Write(xlsxData); err != nil {
		t.Fatalf("Write xlsx: %v", err)
	}
	_ = mw.WriteField("invoiceNo", "HJR-500")
	_ = mw.WriteField("distributor", "پخش هجرت")
	_ = mw.Close()

	upReq := httptest.NewRequest(http.MethodPost, "/api/v1/reconciliations/upload", &body)
	upReq.Header.Set("Content-Type", mw.FormDataContentType())
	upRec := httptest.NewRecorder()
	e.ServeHTTP(upRec, upReq)
	if upRec.Code != http.StatusCreated {
		t.Fatalf("POST upload status = %d, body=%s", upRec.Code, upRec.Body.String())
	}
	var view ReconciliationView
	if err := json.Unmarshal(upRec.Body.Bytes(), &view); err != nil {
		t.Fatalf("unmarshal upload response: %v", err)
	}
	if view.InvoiceNo != "HJR-500" || view.Summary.TotalRows != 4 {
		t.Fatalf("unexpected upload view: invoiceNo=%q totalRows=%d", view.InvoiceNo, view.Summary.TotalRows)
	}

	// 3. Invalid upload without file returns 422
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/reconciliations/upload", nil)
	badRec := httptest.NewRecorder()
	e.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for missing file, got %d", badRec.Code)
	}
}

var _ = requestctx.Actor{}
