package settings

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Get(c echo.Context) error {
	res, err := h.svc.GetSettings(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Update(c echo.Context) error {
	var req UpdateSettingsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "قالب درخواست نامعتبر است")
	}

	actor := audit.Actor{
		ID:       "system_user",
		Name:     "کاربر سیستم",
		Role:     "super_admin",
		Initials: "ک",
	}

	if a, ok := requestctx.Get(c); ok {
		actor = audit.Actor{
			ID:       a.UserID,
			Name:     a.Name,
			Role:     a.Role,
			Initials: a.Initials,
		}
	}

	res, err := h.svc.UpdateSettings(c.Request().Context(), req, actor)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) TestTTAC(c echo.Context) error {
	res, err := h.svc.TestTTAC(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
