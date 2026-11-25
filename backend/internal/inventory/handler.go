package inventory

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func queryFromEcho(c echo.Context) DashboardQuery {
	p := pagination.FromQuery(c, "expiry")
	return DashboardQuery{
		Search:      c.QueryParam("search"),
		Category:    c.QueryParam("category"),
		StockStatus: c.QueryParam("stockStatus"),
		StorageTemp: c.QueryParam("storageTemp"),
		SortBy:      p.SortBy,
		SortDir:     p.SortDir,
		Page:        p.Page,
		PageSize:    p.PageSize,
	}
}

func (h *Handler) Dashboard(c echo.Context) error {
	res, err := h.svc.Dashboard(c.Request().Context(), queryFromEcho(c))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Export(c echo.Context) error {
	body, err := h.svc.ExportCSV(c.Request().Context(), queryFromEcho(c))
	if err != nil {
		return err
	}
	filename := fmt.Sprintf("inventory-%s.csv", time.Now().UTC().Format("20060102-150405"))
	c.Response().Header().Set(echo.HeaderContentDisposition, "attachment; filename="+filename)
	return c.Blob(http.StatusOK, "text/csv; charset=utf-8", body)
}

func (h *Handler) StockIn(c echo.Context) error {
	var req StockInRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.StockIn(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handler) BulkStatus(c echo.Context) error {
	var req BulkStatusRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.BulkUpdateStatus(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
