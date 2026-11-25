package reconciliation

import (
	"context"
	"math"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"pharmastock/backend/internal/drug"
	"pharmastock/backend/pkg/validator"
)

type priceResolver interface {
	ResolveApprovedPrice(ctx context.Context, irc, gtin string) int64
}

// drugCatalogIndex allows O(1) GTIN/IRC/name lookup without N*M scans.
type drugCatalogIndex struct {
	byID          map[string]drug.Drug
	byGTIN        map[string]drug.Drug
	byGenericCode map[string]drug.Drug
	byNormName    map[string]drug.Drug
	all           []drug.Drug
}

func buildDrugIndex(drugs []drug.Drug) drugCatalogIndex {
	idx := drugCatalogIndex{
		byID:          make(map[string]drug.Drug, len(drugs)),
		byGTIN:        make(map[string]drug.Drug, len(drugs)),
		byGenericCode: make(map[string]drug.Drug, len(drugs)),
		byNormName:    make(map[string]drug.Drug, len(drugs)),
		all:           drugs,
	}
	for _, d := range drugs {
		idx.byID[d.ID] = d
		if g := strings.TrimSpace(d.GTIN); g != "" {
			idx.byGTIN[g] = d
		}
		if gc := strings.TrimSpace(d.GenericCode); gc != "" {
			idx.byGenericCode[gc] = d
		}
		if nn := validator.NormalizeFa(d.NameFa); nn != "" {
			idx.byNormName[nn] = d
		}
	}
	return idx
}

func (idx drugCatalogIndex) match(row ReconciledRow) (drug.Drug, bool) {
	if id := strings.TrimSpace(row.DrugID); id != "" {
		if d, ok := idx.byID[id]; ok {
			return d, true
		}
	}
	if g := strings.TrimSpace(row.GTIN); g != "" {
		if d, ok := idx.byGTIN[g]; ok {
			return d, true
		}
	}
	if irc := strings.TrimSpace(row.IRC); irc != "" {
		if d, ok := idx.byGenericCode[irc]; ok {
			return d, true
		}
	}
	if nn := validator.NormalizeFa(row.ExcelName); nn != "" {
		if d, ok := idx.byNormName[nn]; ok {
			return d, true
		}
		// Unique partial match fallback (e.g. "قرص آموکسی‌سیلین ۵۰۰" matching "آموکسی‌سیلین")
		var partialMatches []drug.Drug
		for _, d := range idx.all {
			dn := validator.NormalizeFa(d.NameFa)
			if dn != "" && (strings.Contains(nn, dn) || strings.Contains(dn, nn)) {
				partialMatches = append(partialMatches, d)
			}
		}
		if len(partialMatches) == 1 {
			return partialMatches[0], true
		}
	}
	return drug.Drug{}, false
}

// ExtractRows converts raw spreadsheet rows into ReconciledRow structs using ColumnMapping.
func ExtractRows(rawRows [][]string, m ColumnMapping) []ReconciledRow {
	rows := make([]ReconciledRow, 0, len(rawRows))
	for i, raw := range rawRows {
		name := cellAt(raw, m.NameFa)
		gtin := normalizeCode(cellAt(raw, m.GTIN))
		irc := normalizeCode(cellAt(raw, m.IRC))
		batchNo := strings.TrimSpace(cellAt(raw, m.BatchNo))
		expiryRaw := strings.TrimSpace(cellAt(raw, m.Expiry))
		expiryISO, expiryJalali := ParseFlexibleDate(expiryRaw)
		if expiryJalali != "" {
			expiryRaw = expiryJalali
		}
		qty := parsePositiveInt(cellAt(raw, m.Quantity))
		buyPrice := parseInt64(cellAt(raw, m.BuyPriceRial))
		consumerPrice := parseInt64(cellAt(raw, m.ConsumerPriceRial))
		unit := strings.TrimSpace(cellAt(raw, m.UnitLabel))
		if unit == "" {
			unit = "عدد"
		}

		// Skip rows that have neither a name nor GTIN/IRC
		if name == "" && gtin == "" && irc == "" {
			continue
		}

		rows = append(rows, ReconciledRow{
			ID:                uuid.NewString(),
			RowNumber:         i + 1,
			ExcelName:         name,
			GTIN:              gtin,
			IRC:               irc,
			BatchNo:           batchNo,
			ExpiryRaw:         expiryRaw,
			ExpiryISO:         expiryISO,
			Quantity:          qty,
			UnitLabel:         unit,
			BuyPriceRial:      buyPrice,
			ConsumerPriceRial: consumerPrice,
			MatchStatus:       RowNewItem,
		})
	}
	return rows
}

// ReconcileRows runs catalog + TTAC price matching against all rows in-place.
func ReconcileRows(ctx context.Context, rows []ReconciledRow, drugs []drug.Drug, pr priceResolver) []ReconciledRow {
	idx := buildDrugIndex(drugs)
	priceCache := make(map[string]int64, len(rows))

	out := make([]ReconciledRow, len(rows))
	for i, row := range rows {
		out[i] = evaluateRow(ctx, row, idx, pr, priceCache)
	}
	return out
}

func evaluateRow(ctx context.Context, row ReconciledRow, idx drugCatalogIndex, pr priceResolver, priceCache map[string]int64) ReconciledRow {
	matched, ok := idx.match(row)
	if !ok {
		row.DrugID = ""
		row.CatalogNameFa = ""
		row.MatchStatus = RowNewItem
		row.PriceDiffPct = 0
		row.PriceApproved = false
		row.PriceApprovedBy = ""
		if row.ApprovedPriceRial <= 0 && pr != nil {
			row.ApprovedPriceRial = resolveCachedPrice(ctx, pr, priceCache, row.IRC, row.GTIN)
		}
		return row
	}

	row.DrugID = matched.ID
	catalogLabel := matched.NameFa
	if matched.DosageForm != "" && !strings.Contains(catalogLabel, matched.DosageForm) {
		catalogLabel = matched.DosageForm + " " + catalogLabel
	}
	if matched.Strength != "" && !strings.Contains(catalogLabel, matched.Strength) {
		catalogLabel += " " + matched.Strength
	}
	row.CatalogNameFa = strings.TrimSpace(catalogLabel)
	if row.UnitLabel == "" || row.UnitLabel == "عدد" {
		if matched.UnitLabel != "" {
			row.UnitLabel = matched.UnitLabel
		}
	}
	if row.GTIN == "" && matched.GTIN != "" {
		row.GTIN = matched.GTIN
	}

	var approved int64
	if pr != nil {
		approved = resolveCachedPrice(ctx, pr, priceCache, row.IRC, row.GTIN)
	}
	if approved <= 0 && matched.UnitCost > 0 {
		approved = int64(matched.UnitCost)
	}
	row.ApprovedPriceRial = approved

	if approved > 0 {
		hasConsumerMismatch := row.ConsumerPriceRial > 0 && row.ConsumerPriceRial != approved
		hasBuyOverrun := row.BuyPriceRial > approved
		if hasConsumerMismatch || hasBuyOverrun {
			compared := row.ConsumerPriceRial
			if hasBuyOverrun && (compared <= 0 || compared == approved) {
				compared = row.BuyPriceRial
			}
			row.PriceDiffPct = math.Round((float64(compared-approved)/float64(approved))*1000) / 10
			row.MatchStatus = RowPriceMismatch
			return row
		}
	}

	row.MatchStatus = RowMatched
	row.PriceDiffPct = 0
	row.PriceApproved = false
	row.PriceApprovedBy = ""
	return row
}

func resolveCachedPrice(ctx context.Context, pr priceResolver, cache map[string]int64, irc, gtin string) int64 {
	key := irc + "|" + gtin
	if key == "|" {
		return 0
	}
	if v, ok := cache[key]; ok {
		return v
	}
	v := pr.ResolveApprovedPrice(ctx, irc, gtin)
	cache[key] = v
	return v
}

// ComputeSummary calculates KPI counts and Rial totals from rows and header adjustments.
func ComputeSummary(rows []ReconciledRow, discountRial, vatRial int64) SummaryKPIs {
	var s SummaryKPIs
	s.TotalRows = len(rows)
	s.DiscountRial = discountRial
	s.VatRial = vatRial

	for _, r := range rows {
		if r.Quantity > 0 && r.BuyPriceRial > 0 {
			s.GrossRial += int64(r.Quantity) * r.BuyPriceRial
		}
		switch r.MatchStatus {
		case RowMatched:
			s.MatchedCount++
		case RowNewItem:
			s.NewItemCount++
		case RowPriceMismatch:
			s.PriceMismatchCount++
			if !r.PriceApproved {
				s.UnapprovedMismatchCount++
			}
		}
	}
	if s.TotalRows > 0 {
		s.MatchedPercent = int(math.Round(float64(s.MatchedCount) * 100 / float64(s.TotalRows)))
	}
	s.NetRial = s.GrossRial - s.DiscountRial + s.VatRial
	if s.NetRial < 0 {
		s.NetRial = 0
	}
	s.CanConfirm = s.TotalRows > 0 && s.NewItemCount == 0 && s.UnapprovedMismatchCount == 0
	return s
}

func cellAt(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func normalizeCode(raw string) string {
	s := validator.NormalizeFa(raw)
	return strings.ReplaceAll(s, " ", "")
}

func parsePositiveInt(raw string) int {
	v := parseInt64(raw)
	if v < 0 {
		return 0
	}
	return int(v)
}

func parseInt64(raw string) int64 {
	n := validator.NormalizeFa(raw)
	n = strings.ReplaceAll(n, ",", "")
	n = strings.ReplaceAll(n, "٬", "")
	n = strings.ReplaceAll(n, " ", "")
	if n == "" {
		return 0
	}
	if f, err := strconv.ParseFloat(n, 64); err == nil {
		return int64(math.Round(f))
	}
	return 0
}
