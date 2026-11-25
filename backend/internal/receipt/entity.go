package receipt

import "time"

const (
	StatusDraft     = "draft"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

type Line struct {
	ID                string `bson:"id" json:"id"`
	DrugID            string `bson:"drugId" json:"drugId"`
	NameFa            string `bson:"nameFa" json:"nameFa"`
	GTIN              string `bson:"gtin,omitempty" json:"gtin,omitempty"`
	IRC               string `bson:"irc,omitempty" json:"irc,omitempty"`
	BatchNo           string `bson:"batchNo" json:"batchNo"`
	Expiry            string `bson:"expiry" json:"expiry"`
	Quantity          int    `bson:"quantity" json:"quantity"`
	UnitLabel         string `bson:"unitLabel" json:"unitLabel"`
	BuyPriceRial      int64  `bson:"buyPriceRial" json:"buyPriceRial"`
	ConsumerPriceRial int64  `bson:"consumerPriceRial,omitempty" json:"consumerPriceRial,omitempty"`
	LocationLabel     string `bson:"locationLabel,omitempty" json:"locationLabel,omitempty"`
	BinID             string `bson:"binId,omitempty" json:"binId,omitempty"`
	Zone              string `bson:"zone,omitempty" json:"zone,omitempty"`
}

type Header struct {
	InvoiceNo      string `bson:"invoiceNo" json:"invoiceNo"`
	Distributor    string `bson:"distributor" json:"distributor"`
	IssuedAt       string `bson:"issuedAt" json:"issuedAt"`
	ReceivedAt     string `bson:"receivedAt" json:"receivedAt"`
	WarehouseLabel string `bson:"warehouseLabel" json:"warehouseLabel"`
	PurchaseType   string `bson:"purchaseType" json:"purchaseType"`
	DiscountRial   int64  `bson:"discountRial" json:"discountRial"`
	VatRial        int64  `bson:"vatRial" json:"vatRial"`
	Note           string `bson:"note,omitempty" json:"note,omitempty"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type Receipt struct {
	ID              string     `bson:"_id" json:"id"`
	Status          string     `bson:"status" json:"status"`
	CurrentStep     int        `bson:"currentStep" json:"currentStep"`
	Header          Header     `bson:"header" json:"header"`
	Lines           []Line     `bson:"lines" json:"lines"`
	CreatedBatchIDs []string   `bson:"createdBatchIds,omitempty" json:"createdBatchIds,omitempty"`
	CreatedBy       CreatedBy  `bson:"createdBy" json:"createdBy"`
	CreatedAt       time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time  `bson:"updatedAt" json:"updatedAt"`
	ConfirmedAt     *time.Time `bson:"confirmedAt,omitempty" json:"confirmedAt,omitempty"`
}
