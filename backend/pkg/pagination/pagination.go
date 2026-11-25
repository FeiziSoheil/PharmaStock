package pagination

import (
	"strconv"

	"github.com/labstack/echo/v4"
)

type Params struct {
	Page     int
	PageSize int
	SortBy   string
	SortDir  string
}

type Result[T any] struct {
	Items     []T `json:"items"`
	Total     int `json:"total"`
	Page      int `json:"page"`
	PageSize  int `json:"pageSize"`
	PageCount int `json:"pageCount"`
}

func FromQuery(c echo.Context, defaultSort string) Params {
	page := atoiDefault(c.QueryParam("page"), 1)
	size := atoiDefault(c.QueryParam("pageSize"), 25)
	if page < 1 {
		page = 1
	}
	switch size {
	case 10, 25, 50, 100:
	default:
		size = 25
	}
	sortBy := c.QueryParam("sortBy")
	if sortBy == "" {
		sortBy = defaultSort
	}
	sortDir := c.QueryParam("sortDir")
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "asc"
	}
	return Params{Page: page, PageSize: size, SortBy: sortBy, SortDir: sortDir}
}

func Wrap[T any](items []T, total, page, pageSize int) Result[T] {
	pageCount := 0
	if pageSize > 0 {
		pageCount = (total + pageSize - 1) / pageSize
	}
	if items == nil {
		items = []T{}
	}
	return Result[T]{Items: items, Total: total, Page: page, PageSize: pageSize, PageCount: pageCount}
}

func Skip(page, pageSize int) int64 {
	return int64((page - 1) * pageSize)
}

func atoiDefault(s string, d int) int {
	if s == "" {
		return d
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return d
	}
	return n
}
