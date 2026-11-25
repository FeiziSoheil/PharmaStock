package expiry

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/internal/drug"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "expiry")
	controlled := drug.ParseControlledQuery(c.QueryParam("isControlled"))
	res, err := h.svc.List(c.Request().Context(),
		c.QueryParam("search"), c.QueryParam("bucket"), c.QueryParam("category"),
		c.QueryParam("zone"), c.QueryParam("status"), controlled, p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Create(c echo.Context) error {
	var req CreateRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.Create(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handler) UpdateLocation(c echo.Context) error {
	var req LocationRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.UpdateLocation(c.Request().Context(), c.Param("batchId"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdateStatus(c echo.Context) error {
	var req StatusRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.UpdateStatus(c.Request().Context(), c.Param("batchId"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
