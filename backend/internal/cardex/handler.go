package cardex

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "timestamp")
	res, err := h.svc.List(c.Request().Context(), c.Param("id"), p)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
