package audit

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "timestamp")
	if c.QueryParam("sortDir") == "" {
		p.SortDir = "desc"
	}
	res, err := h.svc.List(c.Request().Context(), ListQuery{
		ActorID: c.QueryParam("actorId"), Role: c.QueryParam("role"),
		Action: c.QueryParam("action"), EntityType: c.QueryParam("entityType"),
		Severity: c.QueryParam("severity"), Search: c.QueryParam("search"),
		Page: p.Page, PageSize: p.PageSize, SortBy: p.SortBy, SortDir: p.SortDir,
	})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Export(c echo.Context) error {
	p := pagination.FromQuery(c, "timestamp")
	format := c.QueryParam("format")
	if format == "" {
		format = "csv"
	}
	body, contentType, err := h.svc.Export(c.Request().Context(), ListQuery{
		ActorID: c.QueryParam("actorId"), Role: c.QueryParam("role"),
		Action: c.QueryParam("action"), EntityType: c.QueryParam("entityType"),
		Severity: c.QueryParam("severity"), Search: c.QueryParam("search"),
		Page: p.Page, PageSize: p.PageSize, SortBy: p.SortBy, SortDir: "desc",
	}, format)
	if err != nil {
		return err
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, "attachment; filename="+h.svc.ExportFilename(format))
	return c.Blob(http.StatusOK, contentType, body)
}
