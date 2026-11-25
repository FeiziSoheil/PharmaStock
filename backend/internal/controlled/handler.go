package controlled

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

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
	q, err := parseListQuery(c)
	if err != nil {
		return err
	}
	res, err := h.svc.List(c.Request().Context(), q)
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
	entry, err := h.svc.Register(c.Request().Context(), req, actor, c.RealIP())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, entry)
}

func (h *Handler) Export(c echo.Context) error {
	q, err := parseListQuery(c)
	if err != nil {
		return err
	}
	format := c.QueryParam("format")
	if format == "" {
		format = "csv"
	}
	body, contentType, err := h.svc.Export(c.Request().Context(), q, format)
	if err != nil {
		return err
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, "attachment; filename="+h.svc.ExportFilename(format))
	return c.Blob(http.StatusOK, contentType, body)
}

func parseListQuery(c echo.Context) (ListQuery, error) {
	p := pagination.FromQuery(c, "timestamp")
	if c.QueryParam("sortDir") == "" {
		p.SortDir = "desc"
	}
	from, err := parseOptionalTime(c.QueryParam("from"), false)
	if err != nil {
		return ListQuery{}, err
	}
	to, err := parseOptionalTime(c.QueryParam("to"), true)
	if err != nil {
		return ListQuery{}, err
	}
	return ListQuery{
		DrugID:   c.QueryParam("drugId"),
		TxType:   c.QueryParam("txType"),
		Search:   c.QueryParam("search"),
		From:     from,
		To:       to,
		Page:     p.Page,
		PageSize: p.PageSize,
		SortBy:   p.SortBy,
		SortDir:  p.SortDir,
	}, nil
}

func parseOptionalTime(raw string, endOfDay bool) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		u := t.UTC()
		return &u, nil
	}
	if d, err := time.Parse("2006-01-02", raw); err == nil {
		if endOfDay {
			d = time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 999000000, time.UTC)
		} else {
			d = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		}
		return &d, nil
	}
	return nil, nil
}
