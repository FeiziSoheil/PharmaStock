package shelf

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "address")
	controlled, _ := strconv.ParseBool(c.QueryParam("controlledOnly"))
	expiring, _ := strconv.ParseBool(c.QueryParam("expiringSoon"))
	res, err := h.svc.List(c.Request().Context(), c.QueryParam("search"), c.QueryParam("zone"), c.QueryParam("macroLocation"), controlled, expiring, p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Get(c echo.Context) error {
	res, err := h.svc.Get(c.Request().Context(), c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
