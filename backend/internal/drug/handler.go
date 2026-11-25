package drug

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "nameFa")
	controlled := ParseControlledQuery(c.QueryParam("isControlled"))
	res, err := h.svc.List(c.Request().Context(), c.QueryParam("search"), c.QueryParam("dosageForm"), c.QueryParam("category"), controlled, p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Get(c echo.Context) error {
	d, err := h.svc.Get(c.Request().Context(), c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, d)
}

func (h *Handler) Create(c echo.Context) error {
	var req UpsertRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	d, err := h.svc.Create(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, d)
}

func (h *Handler) Update(c echo.Context) error {
	var req UpsertRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	d, err := h.svc.Update(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, d)
}

func (h *Handler) LookupTTAC(c echo.Context) error {
	return c.JSON(http.StatusOK, h.svc.LookupTTAC(c.Request().Context(), c.QueryParam("q")))
}

func (h *Handler) SearchTTAC(c echo.Context) error {
	term := strings.TrimSpace(c.QueryParam("term"))
	if term == "" {
		return errormap.Validation("عبارت جستجو خالی است", map[string]string{"term": "الزامی است"})
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
