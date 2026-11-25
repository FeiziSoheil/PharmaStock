package receipt

import "testing"

func TestComputeTotals(t *testing.T) {
	gross, net := ComputeTotals([]Line{
		{Quantity: 10, BuyPriceRial: 1000},
		{Quantity: 5, BuyPriceRial: 2000},
	}, 1500, 0)
	if gross != 20000 || net != 18500 {
		t.Fatalf("got gross=%d net=%d", gross, net)
	}
}
