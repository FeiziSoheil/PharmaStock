package reconciliation

import (
	"testing"
)

func TestParseFlexibleDate(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantISO   string
		wantEmpty bool
	}{
		{name: "jalali latin", input: "1405/02/15", wantISO: "2026-05-05"},
		{name: "jalali persian digits", input: "۱۴۰۶/۰۳/۱۵", wantISO: "2027-06-05"},
		{name: "jalali dash", input: "1405-11-20", wantISO: "2027-02-09"},
		{name: "iso gregorian", input: "2027-06-01", wantISO: "2027-06-01"},
		{name: "excel serial", input: "46500", wantISO: "2027-04-23"},
		{name: "invalid", input: "not-a-date", wantEmpty: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			iso, _ := ParseFlexibleDate(tc.input)
			if tc.wantEmpty {
				if iso != "" {
					t.Fatalf("expected empty iso for %q, got %q", tc.input, iso)
				}
				return
			}
			if iso != tc.wantISO {
				t.Fatalf("ParseFlexibleDate(%q) = %q, want %q", tc.input, iso, tc.wantISO)
			}
		})
	}
}

func TestBuildAndParseTemplateXLSX(t *testing.T) {
	raw, err := BuildTemplateXLSX()
	if err != nil {
		t.Fatalf("BuildTemplateXLSX: %v", err)
	}
	sheet, err := ParseSpreadsheet("template.xlsx", raw)
	if err != nil {
		t.Fatalf("ParseSpreadsheet(xlsx): %v", err)
	}
	if len(sheet.Headers) != 9 {
		t.Fatalf("expected 9 headers, got %d", len(sheet.Headers))
	}
	if len(sheet.RawRows) != 4 {
		t.Fatalf("expected 4 sample rows, got %d", len(sheet.RawRows))
	}
	m := DetectColumnMapping(sheet.Headers, "hijrat")
	if m.NameFa != 1 || m.GTIN != 2 || m.IRC != 3 || m.BatchNo != 4 || m.Expiry != 5 || m.Quantity != 6 || m.BuyPriceRial != 7 || m.ConsumerPriceRial != 8 {
		t.Fatalf("unexpected auto mapping: %+v", m)
	}
}

func TestParseCSVWithBOMAndSemicolon(t *testing.T) {
	csvBytes := append([]byte{0xEF, 0xBB, 0xBF}, []byte("نام کالا;بارکد;بچ;انقضا;تعداد;قیمت خرید\nآموکسی‌سیلین;6260001000001;B1;1406/01/15;10;45000\n")...)
	sheet, err := ParseSpreadsheet("invoice.csv", csvBytes)
	if err != nil {
		t.Fatalf("ParseSpreadsheet(csv): %v", err)
	}
	if len(sheet.RawRows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(sheet.RawRows))
	}
	if sheet.RawRows[0][1] != "6260001000001" {
		t.Fatalf("unexpected GTIN cell: %q", sheet.RawRows[0][1])
	}
}
