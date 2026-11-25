package stocktake

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Create(c echo.Context) error {
	var req CreateCycleRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	view, err := h.svc.Create(c.Request().Context(), req, actor)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, view)
}

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "updatedAt")
	res, err := h.svc.List(c.Request().Context(), c.QueryParam("status"), p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Get(c echo.Context) error {
	view, err := h.svc.Get(c.Request().Context(), c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) Patch(c echo.Context) error {
	var req UpdateSettingsRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	view, err := h.svc.UpdateSettings(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) RecordItem(c echo.Context) error {
	var req RecordItemRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	view, err := h.svc.RecordItem(c.Request().Context(), c.Param("id"), c.Param("itemId"), req, actor)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) Confirm(c echo.Context) error {
	var req ConfirmCycleRequest
	if c.Request().ContentLength > 0 {
		if err := c.Bind(&req); err != nil {
			return err
		}
	}
	actor, _ := requestctx.Get(c)
	view, err := h.svc.Confirm(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) Export(c echo.Context) error {
	data, filename, err := h.svc.ExportCSV(c.Request().Context(), c.Param("id"))
	if err != nil {
		return err
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Blob(http.StatusOK, "text/csv; charset=utf-8", data)
}
