package returns

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Eligible(c echo.Context) error {
	windowDays := DefaultWindowDays
	if raw := c.QueryParam("windowDays"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			windowDays = v
		}
	}
	res, err := h.svc.ListEligible(
		c.Request().Context(),
		windowDays,
		c.QueryParam("search"),
		c.QueryParam("distributorId"),
	)
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
	view, err := h.svc.Create(c.Request().Context(), req, actor)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, view)
}

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "updatedAt")
	res, err := h.svc.List(
		c.Request().Context(),
		c.QueryParam("status"),
		c.QueryParam("distributorId"),
		p,
	)
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

func (h *Handler) Confirm(c echo.Context) error {
	actor, _ := requestctx.Get(c)
	view, err := h.svc.Confirm(c.Request().Context(), c.Param("id"), actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) Settle(c echo.Context) error {
	var req SettleRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	view, err := h.svc.Settle(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}
