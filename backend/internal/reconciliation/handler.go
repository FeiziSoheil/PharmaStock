package reconciliation

import (
	"io"
	"net/http"
	"strconv"

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

func (h *Handler) Template(c echo.Context) error {
	data, err := BuildTemplateXLSX()
	if err != nil {
		return err
	}
	c.Response().Header().Set("Content-Disposition", `attachment; filename="pharmastock-invoice-template.xlsx"`)
	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}

func (h *Handler) Upload(c echo.Context) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return errormap.Validation("انتخاب فایل اکسل یا CSV الزامی است", map[string]string{"file": "فایل ارسال نشده است"})
	}
	if fileHeader.Size > MaxUploadBytes {
		return errormap.Validation("حجم فایل نباید بیش از ۱۰ مگابایت باشد", map[string]string{"file": "حجم فایل بیش از حد مجاز است"})
	}
	src, err := fileHeader.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	data, err := io.ReadAll(io.LimitReader(src, MaxUploadBytes+1))
	if err != nil {
		return err
	}
	if len(data) > MaxUploadBytes {
		return errormap.Validation("حجم فایل نباید بیش از ۱۰ مگابایت باشد", map[string]string{"file": "حجم فایل بیش از حد مجاز است"})
	}

	discount, _ := strconv.ParseInt(c.FormValue("discountRial"), 10, 64)
	vat, _ := strconv.ParseInt(c.FormValue("vatRial"), 10, 64)

	actor, _ := requestctx.Get(c)
	view, err := h.svc.UploadFile(c.Request().Context(), fileHeader.Filename, data, UploadMeta{
		InvoiceNo:      c.FormValue("invoiceNo"),
		Distributor:    c.FormValue("distributor"),
		IssuedAt:       c.FormValue("issuedAt"),
		ReceivedAt:     c.FormValue("receivedAt"),
		WarehouseLabel: c.FormValue("warehouseLabel"),
		TemplateID:     c.FormValue("templateId"),
		DiscountRial:   discount,
		VatRial:        vat,
	}, actor)
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
	var patch DraftPatch
	if err := c.Bind(&patch); err != nil {
		return err
	}
	view, err := h.svc.PatchDraft(c.Request().Context(), c.Param("id"), patch)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) UpdateMapping(c echo.Context) error {
	var req MappingRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	view, err := h.svc.UpdateMapping(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) Rematch(c echo.Context) error {
	var req RematchRequest
	if c.Request().ContentLength > 0 {
		if err := c.Bind(&req); err != nil {
			return err
		}
	}
	view, err := h.svc.Rematch(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) PatchRow(c echo.Context) error {
	var patch RowPatch
	if err := c.Bind(&patch); err != nil {
		return err
	}
	actor, _ := requestctx.Get(c)
	view, err := h.svc.PatchRow(c.Request().Context(), c.Param("id"), c.Param("rowId"), patch, actor)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, view)
}

func (h *Handler) DeleteRow(c echo.Context) error {
	view, err := h.svc.DeleteRow(c.Request().Context(), c.Param("id"), c.Param("rowId"))
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
