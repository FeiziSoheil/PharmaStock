package users

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/requestctx"
)

func newTestEcho(h *Handler, actor requestctx.Actor) *echo.Echo {
	e := echo.New()
	e.HTTPErrorHandler = errormap.HTTPErrorHandler
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			requestctx.Set(c, actor)
			return next(c)
		}
	})
	e.GET("/api/v1/users", h.List)
	e.POST("/api/v1/users", h.Create)
	e.GET("/api/v1/rbac/matrix", h.GetMatrix)
	e.PUT("/api/v1/rbac/matrix", h.UpdateMatrix)
	return e
}

func TestHandlers_UsersAndMatrix(t *testing.T) {
	svc := NewService(newFakeRepo(), &fakeAudit{})
	h := NewHandler(svc)
	e := newTestEcho(h, requestctx.Actor{UserID: "user-admin", Name: "مدیر", Role: "super_admin"})

	// GET /api/v1/rbac/matrix
	req := httptest.NewRequest(http.MethodGet, "/api/v1/rbac/matrix", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET matrix status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// PUT /api/v1/rbac/matrix with regulatory violation -> 422
	bad := DefaultMatrix()
	bad["outbound.controlled_approval"]["warehouse_lead"] = true
	body, _ := json.Marshal(UpdateMatrixRequest{Matrix: bad})
	req2 := httptest.NewRequest(http.MethodPut, "/api/v1/rbac/matrix", bytes.NewReader(body))
	req2.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec2 := httptest.NewRecorder()
	e.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusUnprocessableEntity {
		t.Fatalf("PUT invalid matrix status = %d, body = %s", rec2.Code, rec2.Body.String())
	}

	// POST /api/v1/users -> 201
	userBody, _ := json.Marshal(CreateUserRequest{
		Username:      "new.clerk",
		Name:          "نیما کریمی",
		PersonnelCode: "EMP-3011",
		Role:          "dispensing_clerk",
		BranchID:      "branch-central",
		Password:      "StrongPass123",
	})
	req3 := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewReader(userBody))
	req3.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec3 := httptest.NewRecorder()
	e.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusCreated {
		t.Fatalf("POST user status = %d, body = %s", rec3.Code, rec3.Body.String())
	}
}
