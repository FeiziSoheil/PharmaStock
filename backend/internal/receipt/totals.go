package receipt

func ComputeTotals(lines []Line, discount, vat int64) (gross, net int64) {
	for _, l := range lines {
		gross += int64(l.Quantity) * l.BuyPriceRial
	}
	if discount < 0 {
		discount = 0
	}
	if vat < 0 {
		vat = 0
	}
	return gross, gross - discount + vat
}
