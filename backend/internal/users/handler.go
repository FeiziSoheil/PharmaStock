package users

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c echo.Context) error {
	p := pagination.FromQuery(c, "name")
	res, err := h.svc.List(
		c.Request().Context(),
		c.QueryParam("search"),
		c.QueryParam("role"),
		c.QueryParam("status"),
		c.QueryParam("branchId"),
		p,
	)
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

func (h *Handler) Create(c echo.Context) error {
	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.Create(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handler) Update(c echo.Context) error {
	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.Update(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdateStatus(c echo.Context) error {
	var req UpdateStatusRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.UpdateStatus(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdatePermissions(c echo.Context) error {
	var req UpdateUserPermissionsRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.UpdateUserPermissions(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) ResetPassword(c echo.Context) error {
	var req ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.ResetPassword(c.Request().Context(), c.Param("id"), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) GetMatrix(c echo.Context) error {
	res, err := h.svc.GetMatrix(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdateMatrix(c echo.Context) error {
	var req UpdateMatrixRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	actor, _ := requestctx.Get(c)
	res, err := h.svc.UpdateMatrix(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
