package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"

	"pharmastock/backend/pkg/errormap"
	jwtpkg "pharmastock/backend/pkg/jwt"
	"pharmastock/backend/pkg/requestctx"
)

func JWT(m *jwtpkg.Manager) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Request().Header.Get("Authorization")
			if h == "" || !strings.HasPrefix(h, "Bearer ") {
				return errormap.Unauthorized("احراز هویت لازم است")
			}
			token := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
			claims, err := m.Parse(token)
			if err != nil {
				return errormap.Unauthorized("توکن نامعتبر است")
			}
			initials := initialsOf(claims.Name)
			requestctx.Set(c, requestctx.Actor{
				UserID:   claims.UserID,
				Username: claims.Username,
				Name:     claims.Name,
				Role:     claims.Role,
				BranchID: claims.BranchID,
				Initials: initials,
			})
			return next(c)
		}
	}
}

func initialsOf(name string) string {
	parts := strings.Fields(name)
	if len(parts) == 0 {
		return "?"
	}
	var out strings.Builder
	for i, p := range parts {
		if i >= 2 {
			break
		}
		r := []rune(p)
		if len(r) > 0 {
			out.WriteRune(r[0])
		}
	}
	return out.String()
}
