package ttac

import "strings"

type QueryKind int

const (
	QueryText QueryKind = iota
	QueryIRC
	QueryGTIN
)

func ClassifyQuery(q string) (QueryKind, string) {
	n := strings.TrimSpace(q)
	if n == "" {
		return QueryText, ""
	}
	digits := true
	for _, r := range n {
		if r < '0' || r > '9' {
			digits = false
			break
		}
	}
	if !digits {
		return QueryText, n
	}
	switch len(n) {
	case 16:
		return QueryIRC, n
	case 13, 14:
		return QueryGTIN, n
	default:
		return QueryText, n
	}
}
