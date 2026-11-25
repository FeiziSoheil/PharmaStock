package receipt

// ReceiptView is a receipt plus server-computed totals.
type ReceiptView struct {
	Receipt
	GrossRial int64 `json:"grossRial"`
	NetRial   int64 `json:"netRial"`
}

// HeaderPatch updates draft header fields. Nil fields are left unchanged.
type HeaderPatch struct {
	InvoiceNo      *string `json:"invoiceNo"`
	Distributor    *string `json:"distributor"`
	IssuedAt       *string `json:"issuedAt"`
	ReceivedAt     *string `json:"receivedAt"`
	WarehouseLabel *string `json:"warehouseLabel"`
	PurchaseType   *string `json:"purchaseType"`
	DiscountRial   *int64  `json:"discountRial"`
	VatRial        *int64  `json:"vatRial"`
	Note           *string `json:"note"`
	CurrentStep    *int    `json:"currentStep"`
}

// LineInput is a new draft line. NameFa is resolved from the drug catalog.
type LineInput struct {
	DrugID            string `json:"drugId"`
	BatchNo           string `json:"batchNo"`
	Expiry            string `json:"expiry"`
	Quantity          int    `json:"quantity"`
	UnitLabel         string `json:"unitLabel"`
	BuyPriceRial      int64  `json:"buyPriceRial"`
	ConsumerPriceRial int64  `json:"consumerPriceRial,omitempty"`
	GTIN              string `json:"gtin,omitempty"`
	IRC               string `json:"irc,omitempty"`
	LocationLabel     string `json:"locationLabel,omitempty"`
	BinID             string `json:"binId,omitempty"`
	Zone              string `json:"zone,omitempty"`
}

// LinePatch edits one draft line. Nil fields are left unchanged.
type LinePatch struct {
	DrugID            *string `json:"drugId"`
	BatchNo           *string `json:"batchNo"`
	Expiry            *string `json:"expiry"`
	Quantity          *int    `json:"quantity"`
	UnitLabel         *string `json:"unitLabel"`
	BuyPriceRial      *int64  `json:"buyPriceRial"`
	ConsumerPriceRial *int64  `json:"consumerPriceRial"`
	GTIN              *string `json:"gtin"`
	IRC               *string `json:"irc"`
	LocationLabel     *string `json:"locationLabel"`
	BinID             *string `json:"binId"`
	Zone              *string `json:"zone"`
}
