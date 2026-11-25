package reorder

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
)

type xlsxCell struct {
	Value   string
	Numeric bool
	Style   int // 0: normal, 1: header, 2: total
}

type xlsxSheet struct {
	Name string
	Rows [][]xlsxCell
}

// BuildProformaXLSX creates a valid multi-sheet RTL .xlsx proforma workbook for reorder suggestions.
func BuildProformaXLSX(items []Suggestion, qtyOverrides map[string]int, bufferPct int) ([]byte, error) {
	itemRows := [][]xlsxCell{
		headerCells(
			"ردیف",
			"نام دارو و دوز",
			"شکل دارویی",
			"شناسه IRC",
			"شرکت پخش",
			"گروه دارویی",
			"تحت کنترل",
			"موجودی فعلی",
			"نقطه سفارش (ROP)",
			"سقف هدف (Max)",
			"میانگین مصرف روزانه",
			"زمان تامین (روز)",
			"ضریب بسته‌بندی",
			"پیشنهاد هوشمند",
			"تعداد سفارش نهایی",
			"واحد",
			"قیمت واحد (ریال)",
			"جمع کل (ریال)",
		),
	}

	type distAgg struct {
		nameFa string
		count  int
		qty    int
		cost   int
	}
	byDist := map[string]*distAgg{}

	totalOrderQty := 0
	totalCost := 0

	for idx, it := range items {
		orderQty := it.SuggestedQty
		if override, ok := qtyOverrides[it.ID]; ok {
			orderQty = override
		}
		lineTotal := orderQty * it.UnitCost
		totalOrderQty += orderQty
		totalCost += lineTotal

		agg, ok := byDist[it.DistributorID]
		if !ok {
			agg = &distAgg{nameFa: it.DistributorNameFa}
			byDist[it.DistributorID] = agg
		}
		agg.count++
		agg.qty += orderQty
		agg.cost += lineTotal

		controlledLabel := "خیر"
		if it.IsControlled {
			controlledLabel = "بله (نیازمند تأیید مسئول فنی)"
		}
		fullName := strings.TrimSpace(it.NameFa + " " + it.Strength)
		itemRows = append(itemRows, []xlsxCell{
			numCell(idx + 1),
			strCell(fullName),
			strCell(it.DosageForm),
			strCell(it.IRC),
			strCell(it.DistributorNameFa),
			strCell(it.Category),
			strCell(controlledLabel),
			numCell(it.AvailableStock),
			numCell(it.ReorderPoint),
			numCell(it.TargetStock),
			floatCell(it.AvgDailyUsage),
			numCell(it.LeadTimeDays),
			numCell(it.PackSize),
			numCell(it.SuggestedQty),
			numCell(orderQty),
			strCell(it.UnitLabel),
			numCell(it.UnitCost),
			numCell(lineTotal),
		})
	}

	itemRows = append(itemRows, []xlsxCell{
		totalStrCell("جمع کل"),
		totalStrCell(fmt.Sprintf("%d قلم (حاشیه اطمینان %d%%)", len(items), bufferPct)),
		totalStrCell(""), totalStrCell(""), totalStrCell(""), totalStrCell(""),
		totalStrCell(""), totalStrCell(""), totalStrCell(""), totalStrCell(""),
		totalStrCell(""), totalStrCell(""), totalStrCell(""), totalStrCell(""),
		totalNumCell(totalOrderQty),
		totalStrCell(""),
		totalStrCell(""),
		totalNumCell(totalCost),
	})

	distKeys := make([]string, 0, len(byDist))
	for k := range byDist {
		distKeys = append(distKeys, k)
	}
	sort.Slice(distKeys, func(i, j int) bool {
		return byDist[distKeys[i]].nameFa < byDist[distKeys[j]].nameFa
	})

	summaryRows := [][]xlsxCell{
		headerCells("ردیف", "شرکت پخش", "تعداد اقلام", "مجموع تعداد سفارش", "جمع برآورد ریالی (ریال)"),
	}
	for idx, k := range distKeys {
		agg := byDist[k]
		summaryRows = append(summaryRows, []xlsxCell{
			numCell(idx + 1),
			strCell(agg.nameFa),
			numCell(agg.count),
			numCell(agg.qty),
			numCell(agg.cost),
		})
	}
	summaryRows = append(summaryRows, []xlsxCell{
		totalStrCell("جمع کل"),
		totalStrCell(fmt.Sprintf("%d شرکت پخش", len(distKeys))),
		totalNumCell(len(items)),
		totalNumCell(totalOrderQty),
		totalNumCell(totalCost),
	})

	return buildMultiSheetXLSX([]xlsxSheet{
		{Name: "اقلام پیش‌فاکتور", Rows: itemRows},
		{Name: "خلاصه به تفکیک پخش", Rows: summaryRows},
	})
}

// BuildPurchaseOrderXLSX creates a valid RTL .xlsx workbook for a persisted PurchaseOrder.
func BuildPurchaseOrderXLSX(po PurchaseOrder) ([]byte, error) {
	rows := [][]xlsxCell{
		headerCells(
			"ردیف",
			"شماره سفارش",
			"شرکت پخش",
			"نام دارو و دوز",
			"شکل دارویی",
			"شناسه IRC",
			"تحت کنترل",
			"ضریب بسته‌بندی",
			"تعداد سفارش",
			"واحد",
			"قیمت واحد (ریال)",
			"جمع کل (ریال)",
		),
	}
	for idx, it := range po.Items {
		controlledLabel := "خیر"
		if it.IsControlled {
			controlledLabel = "بله"
		}
		fullName := strings.TrimSpace(it.NameFa + " " + it.Strength)
		if fullName == "" {
			fullName = it.DrugID
		}
		lineTotal := it.LineTotal
		if lineTotal == 0 && it.UnitCost > 0 {
			lineTotal = it.FinalQty * it.UnitCost
		}
		rows = append(rows, []xlsxCell{
			numCell(idx + 1),
			strCell(po.OrderNumber),
			strCell(po.DistributorNameFa),
			strCell(fullName),
			strCell(it.DosageForm),
			strCell(it.IRC),
			strCell(controlledLabel),
			numCell(it.PackSize),
			numCell(it.FinalQty),
			strCell(it.UnitLabel),
			numCell(it.UnitCost),
			numCell(lineTotal),
		})
	}
	rows = append(rows, []xlsxCell{
		totalStrCell("جمع کل"),
		totalStrCell(po.OrderNumber),
		totalStrCell(po.DistributorNameFa),
		totalStrCell(fmt.Sprintf("%d قلم", len(po.Items))),
		totalStrCell(""), totalStrCell(""), totalStrCell(""), totalStrCell(""),
		totalNumCell(po.TotalQty),
		totalStrCell(""), totalStrCell(""),
		totalNumCell(po.TotalCost),
	})

	return buildMultiSheetXLSX([]xlsxSheet{
		{Name: "جزئیات سفارش خرید", Rows: rows},
	})
}

func headerCells(labels ...string) []xlsxCell {
	out := make([]xlsxCell, len(labels))
	for i, l := range labels {
		out[i] = xlsxCell{Value: l, Style: 1}
	}
	return out
}

func strCell(v string) xlsxCell      { return xlsxCell{Value: v} }
func numCell(v int) xlsxCell         { return xlsxCell{Value: strconv.Itoa(v), Numeric: true} }
func totalStrCell(v string) xlsxCell { return xlsxCell{Value: v, Style: 2} }
func totalNumCell(v int) xlsxCell    { return xlsxCell{Value: strconv.Itoa(v), Numeric: true, Style: 2} }

func floatCell(v float64) xlsxCell {
	return xlsxCell{Value: strconv.FormatFloat(v, 'f', 1, 64), Numeric: true}
}

func buildMultiSheetXLSX(sheets []xlsxSheet) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	var ctOverrides strings.Builder
	var wbSheets strings.Builder
	var wbRels strings.Builder

	files := map[string]string{
		"_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
		"xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Tahoma"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF005C55"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECEEF0"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
</styleSheet>`,
	}

	for i, s := range sheets {
		sheetNum := i + 1
		partPath := fmt.Sprintf("xl/worksheets/sheet%d.xml", sheetNum)
		relTarget := fmt.Sprintf("worksheets/sheet%d.xml", sheetNum)
		rID := fmt.Sprintf("rId%d", sheetNum)

		fmt.Fprintf(&ctOverrides, `  <Override PartName="/%s" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`+"\n", partPath)
		var escName bytes.Buffer
		_ = xml.EscapeText(&escName, []byte(s.Name))
		fmt.Fprintf(&wbSheets, `    <sheet name="%s" sheetId="%d" r:id="%s"/>`+"\n", escName.String(), sheetNum, rID)
		fmt.Fprintf(&wbRels, `  <Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="%s"/>`+"\n", rID, relTarget)

		files[partPath] = buildStyledSheetXML(s.Rows)
	}

	stylesRelID := fmt.Sprintf("rId%d", len(sheets)+1)
	fmt.Fprintf(&wbRels, `  <Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`+"\n", stylesRelID)

	files["[Content_Types].xml"] = fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
%s</Types>`, ctOverrides.String())

	files["xl/workbook.xml"] = fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
%s  </sheets>
</workbook>`, wbSheets.String())

	files["xl/_rels/workbook.xml.rels"] = fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
%s</Relationships>`, wbRels.String())

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

func buildStyledSheetXML(rows [][]xlsxCell) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	sb.WriteString(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`)
	sb.WriteString(`<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>`)
	sb.WriteString(`<sheetData>`)
	for rIdx, row := range rows {
		rNum := rIdx + 1
		fmt.Fprintf(&sb, `<row r="%d">`, rNum)
		for cIdx, cell := range row {
			ref := fmt.Sprintf("%s%d", colIndexToLetter(cIdx), rNum)
			styleAttr := ""
			if cell.Style > 0 {
				styleAttr = fmt.Sprintf(` s="%d"`, cell.Style)
			}
			if cell.Numeric {
				sb.WriteString(`<c r="` + ref + `"` + styleAttr + `><v>`)
				_ = xml.EscapeText(&sb, []byte(cell.Value))
				sb.WriteString(`</v></c>`)
			} else {
				sb.WriteString(`<c r="` + ref + `"` + styleAttr + ` t="inlineStr"><is><t>`)
				_ = xml.EscapeText(&sb, []byte(cell.Value))
				sb.WriteString(`</t></is></c>`)
			}
		}
		sb.WriteString(`</row>`)
	}
	sb.WriteString(`</sheetData></worksheet>`)
	return sb.String()
}

func colIndexToLetter(idx int) string {
	res := ""
	n := idx
	for {
		rem := n % 26
		res = string(rune('A'+rem)) + res
		n = n/26 - 1
		if n < 0 {
			break
		}
	}
	return res
}
