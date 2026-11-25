package requestctx

import "github.com/labstack/echo/v4"

const Key = "pharmastock.actor"

type Actor struct {
	UserID   string
	Username string
	Name     string
	Role     string
	BranchID string
	Initials string
}

func Set(c echo.Context, a Actor) {
	c.Set(Key, a)
}

func Get(c echo.Context) (Actor, bool) {
	v := c.Get(Key)
	a, ok := v.(Actor)
	return a, ok
}
