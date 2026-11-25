package reconciliation

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"

	"pharmastock/backend/pkg/validator"
)

const (
	MaxUploadBytes = 10 << 20 // 10 MiB
	MaxParsedRows  = 2000
)

type ParsedSheet struct {
	Headers      []string
	ColumnLabels []string
	RawRows      [][]string
}

// ParseSpreadsheet reads an .xlsx or .csv file into headers, Excel column letters, and data rows.
func ParseSpreadsheet(filename string, data []byte) (ParsedSheet, error) {
	if len(data) == 0 {
		return ParsedSheet{}, fmt.Errorf("فایل انتخاب‌شده خالی است")
	}
	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(filename)))
	var matrix [][]string
	var err error
	switch ext {
	case ".xlsx":
		matrix, err = parseXLSX(data)
	case ".csv":
		matrix, err = parseCSV(data)
	default:
		return ParsedSheet{}, fmt.Errorf("فرمت فایل باید اکسل (.xlsx) یا CSV (.csv) باشد")
	}
	if err != nil {
		return ParsedSheet{}, err
	}
	if len(matrix) < 2 {
		return ParsedSheet{}, fmt.Errorf("فایل باید حداقل یک سطر عنوان و یک سطر داده داشته باشد")
	}

	headers := normalizeRowCells(matrix[0])
	maxCols := len(headers)
	rawRows := make([][]string, 0, len(matrix)-1)
	for _, r := range matrix[1:] {
		if isBlankRow(r) {
			continue
		}
		if len(r) > maxCols {
			maxCols = len(r)
		}
		rawRows = append(rawRows, r)
		if len(rawRows) >= MaxParsedRows {
			break
		}
	}
	if len(rawRows) == 0 {
		return ParsedSheet{}, fmt.Errorf("هیچ ردیف داده‌ای در فایل یافت نشد")
	}

	// Pad headers & rows uniformly to maxCols
	for len(headers) < maxCols {
		headers = append(headers, fmt.Sprintf("ستون %s", colIndexToLetter(len(headers))))
	}
	colLabels := make([]string, maxCols)
	for i := 0; i < maxCols; i++ {
		colLabels[i] = colIndexToLetter(i)
		if strings.TrimSpace(headers[i]) == "" {
			headers[i] = "ستون " + colLabels[i]
		}
	}
	for i := range rawRows {
		row := make([]string, maxCols)
		for j := 0; j < maxCols && j < len(rawRows[i]); j++ {
			row[j] = strings.TrimSpace(rawRows[i][j])
		}
		rawRows[i] = row
	}

	return ParsedSheet{
		Headers:      headers,
		ColumnLabels: colLabels,
		RawRows:      rawRows,
	}, nil
}

func parseCSV(data []byte) ([][]string, error) {
	// Strip UTF-8 BOM if present
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	// Detect semicolon vs comma delimiter from header line
	firstLine := string(data)
	if idx := strings.IndexByte(firstLine, '\n'); idx >= 0 {
		firstLine = firstLine[:idx]
	}
	r := csv.NewReader(bytes.NewReader(data))
	if strings.Count(firstLine, ";") > strings.Count(firstLine, ",") {
		r.Comma = ';'
	}
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("خطا در خواندن فایل CSV: %w", err)
	}
	return records, nil
}

type xlsxSharedStrings struct {
	SI []struct {
		T string `xml:"t"`
		R []struct {
			T string `xml:"t"`
		} `xml:"r"`
	} `xml:"si"`
}

type xlsxWorksheet struct {
	SheetData struct {
		Rows []struct {
			R     int `xml:"r,attr"`
			Cells []struct {
				R  string `xml:"r,attr"`
				T  string `xml:"t,attr"`
				V  string `xml:"v"`
				IS struct {
					T string `xml:"t"`
					R []struct {
						T string `xml:"t"`
					} `xml:"r"`
				} `xml:"is"`
			} `xml:"c"`
		} `xml:"row"`
	} `xml:"sheetData"`
}

func parseXLSX(data []byte) ([][]string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("فایل اکسل نامعتبر است")
	}

	var sharedStrings []string
	var sheetFile *zip.File
	for _, f := range zr.File {
		name := strings.ToLower(f.Name)
		switch name {
		case "xl/sharedstrings.xml":
			ss, err := readSharedStrings(f)
			if err != nil {
				return nil, fmt.Errorf("خطا در خواندن رشته‌های فایل اکسل")
			}
			sharedStrings = ss
		case "xl/worksheets/sheet1.xml":
			sheetFile = f
		default:
			if sheetFile == nil && strings.HasPrefix(name, "xl/worksheets/sheet") && strings.HasSuffix(name, ".xml") {
				sheetFile = f
			}
		}
	}
	if sheetFile == nil {
		return nil, fmt.Errorf("برگه (Sheet) معتبری در فایل اکسل یافت نشد")
	}

	rc, err := sheetFile.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	var ws xlsxWorksheet
	if err := xml.NewDecoder(io.LimitReader(rc, 25<<20)).Decode(&ws); err != nil {
		return nil, fmt.Errorf("ساختار XML فایل اکسل نامعتبر است")
	}

	rows := make([][]string, 0, len(ws.SheetData.Rows))
	for _, xrow := range ws.SheetData.Rows {
		rowMap := make(map[int]string, len(xrow.Cells))
		maxCol := -1
		for idx, cell := range xrow.Cells {
			colIdx := idx
			if cell.R != "" {
				if parsed := cellRefToColIndex(cell.R); parsed >= 0 {
					colIdx = parsed
				}
			}
			if colIdx > maxCol {
				maxCol = colIdx
			}
			var val string
			switch cell.T {
			case "s":
				if siIdx, err := strconv.Atoi(strings.TrimSpace(cell.V)); err == nil && siIdx >= 0 && siIdx < len(sharedStrings) {
					val = sharedStrings[siIdx]
				}
			case "inlineStr":
				if cell.IS.T != "" {
					val = cell.IS.T
				} else {
					var sb strings.Builder
					for _, run := range cell.IS.R {
						sb.WriteString(run.T)
					}
					val = sb.String()
				}
			default:
				val = cell.V
			}
			rowMap[colIdx] = strings.TrimSpace(val)
		}
		if maxCol < 0 {
			continue
		}
		row := make([]string, maxCol+1)
		for k, v := range rowMap {
			row[k] = v
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func readSharedStrings(f *zip.File) ([]string, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	var ss xlsxSharedStrings
	if err := xml.NewDecoder(io.LimitReader(rc, 10<<20)).Decode(&ss); err != nil {
		return nil, err
	}
	out := make([]string, len(ss.SI))
	for i, item := range ss.SI {
		if item.T != "" {
			out[i] = item.T
			continue
		}
		var sb strings.Builder
		for _, r := range item.R {
			sb.WriteString(r.T)
		}
		out[i] = sb.String()
	}
	return out, nil
}

func cellRefToColIndex(ref string) int {
	col := 0
	hasLetter := false
	for _, ch := range ref {
		if ch >= 'A' && ch <= 'Z' {
			hasLetter = true
			col = col*26 + int(ch-'A'+1)
		} else if ch >= 'a' && ch <= 'z' {
			hasLetter = true
			col = col*26 + int(ch-'a'+1)
		} else if unicode.IsDigit(ch) {
			break
		}
	}
	if !hasLetter {
		return -1
	}
	return col - 1
}

func colIndexToLetter(idx int) string {
	if idx < 0 {
		return ""
	}
	var res []byte
	for idx >= 0 {
		res = append([]byte{byte('A' + (idx % 26))}, res...)
		idx = idx/26 - 1
	}
	return string(res)
}

func normalizeRowCells(row []string) []string {
	out := make([]string, len(row))
	for i, v := range row {
		out[i] = strings.TrimSpace(v)
	}
	return out
}

func isBlankRow(row []string) bool {
	for _, v := range row {
		if strings.TrimSpace(v) != "" {
			return false
		}
	}
	return true
}

// DetectColumnMapping matches header names (Persian & English) or falls back to standard template positions.
func DetectColumnMapping(headers []string, templateID string) ColumnMapping {
	m := ColumnMapping{
		NameFa: -1, GTIN: -1, IRC: -1, BatchNo: -1,
		Expiry: -1, Quantity: -1, BuyPriceRial: -1, ConsumerPriceRial: -1, UnitLabel: -1,
	}

	for i, h := range headers {
		n := validator.NormalizeFa(h)
		switch {
		case m.NameFa < 0 && (strings.Contains(n, "نام") || strings.Contains(n, "کالا") || strings.Contains(n, "دارو") || strings.Contains(n, "name") || strings.Contains(n, "drug")):
			m.NameFa = i
		case m.GTIN < 0 && (strings.Contains(n, "gtin") || strings.Contains(n, "بارکد") || strings.Contains(n, "barcode")):
			m.GTIN = i
		case m.IRC < 0 && (strings.Contains(n, "irc") || strings.Contains(n, "ژنریک") || strings.Contains(n, "تیتک") || strings.Contains(n, "تی‌تک")):
			m.IRC = i
		case m.BatchNo < 0 && (strings.Contains(n, "بچ") || strings.Contains(n, "سری ساخت") || strings.Contains(n, "سری‌ساخت") || strings.Contains(n, "پارت") || strings.Contains(n, "batch") || strings.Contains(n, "lot")):
			m.BatchNo = i
		case m.Expiry < 0 && (strings.Contains(n, "انقضا") || strings.Contains(n, "تاریخ") || strings.Contains(n, "exp")):
			m.Expiry = i
		case m.Quantity < 0 && (strings.Contains(n, "تعداد") || strings.Contains(n, "مقدار") || strings.Contains(n, "بسته") || strings.Contains(n, "qty") || strings.Contains(n, "quantity")):
			m.Quantity = i
		case m.ConsumerPriceRial < 0 && (strings.Contains(n, "مصرف") || strings.Contains(n, "consumer")):
			m.ConsumerPriceRial = i
		case m.BuyPriceRial < 0 && (strings.Contains(n, "خرید") || strings.Contains(n, "فی") || strings.Contains(n, "قیمت") || strings.Contains(n, "price") || strings.Contains(n, "buy")):
			m.BuyPriceRial = i
		case m.UnitLabel < 0 && (strings.Contains(n, "واحد") || strings.Contains(n, "unit")):
			m.UnitLabel = i
		}
	}

	// Standard distributor layout fallback (A=rowNo, B=name, C=gtin, D=irc, E=batch, F=expiry, G=qty, H=buy, I=consumer)
	if m.NameFa < 0 && len(headers) >= 8 {
		start := 0
		if len(headers) >= 9 && (strings.Contains(validator.NormalizeFa(headers[0]), "ردیف") || headers[0] == "#") {
			start = 1
		}
		if m.NameFa < 0 && start < len(headers) {
			m.NameFa = start
		}
		if m.GTIN < 0 && start+1 < len(headers) {
			m.GTIN = start + 1
		}
		if m.IRC < 0 && start+2 < len(headers) {
			m.IRC = start + 2
		}
		if m.BatchNo < 0 && start+3 < len(headers) {
			m.BatchNo = start + 3
		}
		if m.Expiry < 0 && start+4 < len(headers) {
			m.Expiry = start + 4
		}
		if m.Quantity < 0 && start+5 < len(headers) {
			m.Quantity = start + 5
		}
		if m.BuyPriceRial < 0 && start+6 < len(headers) {
			m.BuyPriceRial = start + 6
		}
		if m.ConsumerPriceRial < 0 && start+7 < len(headers) {
			m.ConsumerPriceRial = start + 7
		}
	}

	return m
}

// BuildTemplateXLSX creates a valid standard .xlsx file with Persian headers & realistic sample rows.
func BuildTemplateXLSX() ([]byte, error) {
	rows := [][]string{
		{"ردیف", "نام کالا (دارو)", "بارکد تجاری / GTIN", "شناسه IRC", "شماره بچ (سری ساخت)", "تاریخ انقضا (شمسی)", "تعداد / بسته", "قیمت خرید فاکتور", "قیمت مصرف‌کننده"},
		{"1", "آموکسی‌سیلین ۵۰۰ میلی‌گرم", "6260001000001", "6260001000001001", "AMX-2026", "1406/03/15", "50", "45000", "45000"},
		{"2", "انسولین قلمی لانتوس", "6260001000002", "77881", "INS-8840", "1405/11/20", "20", "890000", "890000"},
		{"3", "کپسول دوکسوروبیسین ۵۰ م‌گ (نانودارو)", "6268800109924", "6268800109924001", "DOX-204", "1406/07/10", "10", "1850000", "1850000"},
		{"4", "مورفین سولفات ۱۰ میلی‌گرم", "6260001000003", "99001", "MRF-991", "1406/09/01", "15", "125000", "125000"},
	}
	return writeMinimalXLSX(rows)
}

func writeMinimalXLSX(rows [][]string) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	files := map[string]string{
		"[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
		"_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
		"xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="PurchaseInvoice" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
		"xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
		"xl/worksheets/sheet1.xml": buildSheetXML(rows),
	}

	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := io.WriteString(w, content); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func buildSheetXML(rows [][]string) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	sb.WriteString(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`)
	for rIdx, row := range rows {
		rNum := rIdx + 1
		fmt.Fprintf(&sb, `<row r="%d">`, rNum)
		for cIdx, val := range row {
			ref := fmt.Sprintf("%s%d", colIndexToLetter(cIdx), rNum)
			sb.WriteString(`<c r="` + ref + `" t="inlineStr"><is><t>`)
			_ = xml.EscapeText(&sb, []byte(val))
			sb.WriteString(`</t></is></c>`)
		}
		sb.WriteString(`</row>`)
	}
	sb.WriteString(`</sheetData></worksheet>`)
	return sb.String()
}
