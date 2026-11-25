package auth

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/requestctx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("درخواست نامعتبر است", nil)
	}
	req.Username = strings.TrimSpace(req.Username)
	req.BranchID = strings.TrimSpace(req.BranchID)
	fields := map[string]string{}
	if req.Username == "" {
		fields["username"] = "شناسه پرسنلی الزامی است"
	}
	if req.Password == "" {
		fields["password"] = "رمز عبور الزامی است"
	}
	if req.BranchID == "" {
		fields["branchId"] = "انتخاب شعبه الزامی است"
	}
	if len(fields) > 0 {
		return errormap.Validation("لطفاً فیلدهای الزامی را تکمیل کنید", fields)
	}
	body, status := h.svc.Login(c.Request().Context(), req, c.RealIP())
	return c.JSON(status, body)
}

func (h *Handler) Me(c echo.Context) error {
	actor, ok := requestctx.Get(c)
	if !ok || actor.UserID == "" {
		return errormap.Unauthorized("احراز هویت لازم است")
	}
	res, err := h.svc.GetMe(c.Request().Context(), actor)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) UpdateMe(c echo.Context) error {
	actor, ok := requestctx.Get(c)
	if !ok || actor.UserID == "" {
		return errormap.Unauthorized("احراز هویت لازم است")
	}
	var req UpdateMeRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	res, err := h.svc.UpdateMe(c.Request().Context(), actor, req, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) ChangePassword(c echo.Context) error {
	actor, ok := requestctx.Get(c)
	if !ok || actor.UserID == "" {
		return errormap.Unauthorized("احراز هویت لازم است")
	}
	var req ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Validation("ساختار درخواست نامعتبر است", nil)
	}
	res, err := h.svc.ChangePassword(c.Request().Context(), actor, req, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}
