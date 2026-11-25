package reorder

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/internal/drug"
	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "daysOfCover")
	controlled := drug.ParseControlledQuery(c.QueryParam("isControlled"))
	activeOnly := true
	if v := c.QueryParam("activeOnly"); v != "" {
		activeOnly, _ = strconv.ParseBool(v)
	}
	res, err := h.svc.List(c.Request().Context(),
		c.QueryParam("search"), c.QueryParam("distributorId"), c.QueryParam("category"),
		c.QueryParam("urgency"), controlled, activeOnly, p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) GetSettings(c echo.Context) error {
	cfg, err := h.svc.GetSettings(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, cfg)
}

func (h *Handler) UpdateSettings(c echo.Context) error {
	var cfg domain.ReorderFormulaConfig
	if err := c.Bind(&cfg); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	updated, err := h.svc.UpdateSettings(c.Request().Context(), cfg, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *Handler) Draft(c echo.Context) error {
	var req DraftRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.Draft(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) ListOrders(c echo.Context) error {
	res, err := h.svc.ListOrders(c.Request().Context(), c.QueryParam("status"), c.QueryParam("distributorId"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdateOrderStatus(c echo.Context) error {
	var req UpdateOrderStatusRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	po, err := h.svc.UpdateOrderStatus(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, po)
}

func (h *Handler) Export(c echo.Context) error {
	var req ExportRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	body, filename, err := h.svc.ExportProforma(c.Request().Context(), req)
	if err != nil {
		return err
	}
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Blob(http.StatusOK, xlsxContentType, body)
}

func (h *Handler) ExportOrder(c echo.Context) error {
	body, filename, err := h.svc.ExportOrder(c.Request().Context(), c.Param("id"))
	if err != nil {
		return err
	}
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Blob(http.StatusOK, xlsxContentType, body)
}

func (h *Handler) Dismiss(c echo.Context) error {
	var req DismissRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if err := h.svc.Dismiss(c.Request().Context(), req); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true})
}
