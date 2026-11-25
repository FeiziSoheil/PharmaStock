package dispensing

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Create(c echo.Context) error {
	var in CreateRequest
	if err := c.Bind(&in); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	view, err := h.svc.Create(c.Request().Context(), in.Patient, in.Fees, actor)
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
	var patch PatientFeesPatch
	if err := c.Bind(&patch); err != nil {
		return err
	}
	view, err := h.svc.Patch(c.Request().Context(), c.Param("id"), patch)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) AddLine(c echo.Context) error {
	var in LineInput
	if err := c.Bind(&in); err != nil {
		return err
	}
	view, err := h.svc.AddLine(c.Request().Context(), c.Param("id"), in)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, view)
}

func (h *Handler) PatchLine(c echo.Context) error {
	var patch LinePatch
	if err := c.Bind(&patch); err != nil {
		return err
	}
	view, err := h.svc.PatchLine(c.Request().Context(), c.Param("id"), c.Param("lineId"), patch)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) DeleteLine(c echo.Context) error {
	view, err := h.svc.DeleteLine(c.Request().Context(), c.Param("id"), c.Param("lineId"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) ClearLines(c echo.Context) error {
	view, err := h.svc.ClearLines(c.Request().Context(), c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) Confirm(c echo.Context) error {
	actor, _ := requestctx.Get(c)
	view, err := h.svc.Confirm(c.Request().Context(), c.Param("id"), actor)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) FEFOPreview(c echo.Context) error {
	batch, err := h.svc.FEFOPreview(c.Request().Context(), c.QueryParam("drugId"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, batch)
}
