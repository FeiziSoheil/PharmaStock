package settings

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestHandler_Get(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := NewService(&mockRepo{data: nil}, nil)
	h := NewHandler(svc)

	if err := h.Get(c); err != nil {
		t.Fatalf("handler get failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

func TestHandler_Update(t *testing.T) {
	e := echo.New()
	valid := DefaultSettings()
	valid.PharmacyIdentity.NameFa = "داروخانه سینا"
	updateReq := UpdateSettingsRequest{
		PharmacyIdentity: valid.PharmacyIdentity,
		InventoryRules:   valid.InventoryRules,
		TTACIntegration:  valid.TTACIntegration,
		SecurityConfig:   valid.SecurityConfig,
	}

	body, _ := json.Marshal(updateReq)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := NewService(&mockRepo{data: nil}, &mockAudit{})
	h := NewHandler(svc)

	if err := h.Update(c); err != nil {
		t.Fatalf("handler update failed: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}
