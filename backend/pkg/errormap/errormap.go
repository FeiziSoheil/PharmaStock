package errormap

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	HTTPStatus int    `json:"-"`
	Fields     any    `json:"fields,omitempty"`
}

func (e *AppError) Error() string { return e.Message }

func New(status int, code, message string) *AppError {
	return &AppError{HTTPStatus: status, Code: code, Message: message}
}

func Validation(message string, fields any) *AppError {
	return &AppError{HTTPStatus: http.StatusUnprocessableEntity, Code: "validation_error", Message: message, Fields: fields}
}

func NotFound(message string) *AppError {
	return New(http.StatusNotFound, "not_found", message)
}

func Conflict(message string) *AppError {
	return New(http.StatusConflict, "conflict", message)
}

func Unauthorized(message string) *AppError {
	return New(http.StatusUnauthorized, "unauthorized", message)
}

type body struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Fields  any    `json:"fields,omitempty"`
}

func HTTPErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	var app *AppError
	if errors.As(err, &app) {
		_ = c.JSON(app.HTTPStatus, body{Code: app.Code, Message: app.Message, Fields: app.Fields})
		return
	}
	if he, ok := err.(*echo.HTTPError); ok {
		msg, _ := he.Message.(string)
		if msg == "" {
			msg = http.StatusText(he.Code)
		}
		_ = c.JSON(he.Code, body{Code: "http_error", Message: msg})
		return
	}
	_ = c.JSON(http.StatusInternalServerError, body{Code: "internal_error", Message: "خطای داخلی سرور"})
}
