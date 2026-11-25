package validator

import (
	"strings"
	"unicode"
)

var digitMap = map[rune]rune{
	'۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
	'۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
	'٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
	'٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}

// NormalizeFa folds Arabic ye/ke variants and Persian/Arabic digits for search.
func NormalizeFa(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case 'ي', 'ى':
			r = 'ی'
		case 'ك':
			r = 'ک'
		}
		if d, ok := digitMap[r]; ok {
			r = d
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return strings.TrimSpace(b.String())
}
