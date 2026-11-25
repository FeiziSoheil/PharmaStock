package ttac

import "context"

type Gateway interface {
	Search(ctx context.Context, term string, page, pageSize int) (hits []SearchHit, count int, err error)
	ByIRC(ctx context.Context, irc string) (MappedProduct, error)
}
