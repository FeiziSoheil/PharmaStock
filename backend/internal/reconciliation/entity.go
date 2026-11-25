package reconciliation

import "time"

const (
	StatusUploaded  = "uploaded"
	StatusMapped    = "mapped"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

const (
	RowMatched       = "matched"
	RowNewItem       = "new_item"
	RowPriceMismatch = "price_mismatch"
)

// ColumnMapping maps 0-based Excel column indexes (-1 means unmapped) to PharmaStock fields.
type ColumnMapping struct {
	NameFa            int `bson:"nameFa" json:"nameFa"`
	GTIN              int `bson:"gtin" json:"gtin"`
	IRC               int `bson:"irc" json:"irc"`
	BatchNo           int `bson:"batchNo" json:"batchNo"`
	Expiry            int `bson:"expiry" json:"expiry"`
	Quantity          int `bson:"quantity" json:"quantity"`
	BuyPriceRial      int `bson:"buyPriceRial" json:"buyPriceRial"`
	ConsumerPriceRial int `bson:"consumerPriceRial" json:"consumerPriceRial"`
	UnitLabel         int `bson:"unitLabel" json:"unitLabel"`
}

// ReconciledRow represents one parsed invoice row after catalog & TTAC matching.
type ReconciledRow struct {
	ID                string  `bson:"id" json:"id"`
	RowNumber         int     `bson:"rowNumber" json:"rowNumber"`
	ExcelName         string  `bson:"excelName" json:"excelName"`
	GTIN              string  `bson:"gtin,omitempty" json:"gtin,omitempty"`
	IRC               string  `bson:"irc,omitempty" json:"irc,omitempty"`
	BatchNo           string  `bson:"batchNo" json:"batchNo"`
	ExpiryRaw         string  `bson:"expiryRaw,omitempty" json:"expiryRaw,omitempty"`
	ExpiryISO         string  `bson:"expiryISO" json:"expiryISO"`
	Quantity          int     `bson:"quantity" json:"quantity"`
	UnitLabel         string  `bson:"unitLabel" json:"unitLabel"`
	BuyPriceRial      int64   `bson:"buyPriceRial" json:"buyPriceRial"`
	ConsumerPriceRial int64   `bson:"consumerPriceRial,omitempty" json:"consumerPriceRial,omitempty"`
	ApprovedPriceRial int64   `bson:"approvedPriceRial,omitempty" json:"approvedPriceRial,omitempty"`
	PriceDiffPct      float64 `bson:"priceDiffPct,omitempty" json:"priceDiffPct,omitempty"`
	DrugID            string  `bson:"drugId,omitempty" json:"drugId,omitempty"`
	CatalogNameFa     string  `bson:"catalogNameFa,omitempty" json:"catalogNameFa,omitempty"`
	MatchStatus       string  `bson:"matchStatus" json:"matchStatus"`
	PriceApproved     bool    `bson:"priceApproved,omitempty" json:"priceApproved,omitempty"`
	PriceApprovedBy   string  `bson:"priceApprovedBy,omitempty" json:"priceApprovedBy,omitempty"`
	LocationLabel     string  `bson:"locationLabel,omitempty" json:"locationLabel,omitempty"`
	BinID             string  `bson:"binId,omitempty" json:"binId,omitempty"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

// Reconciliation stores an uploaded purchase invoice Excel/CSV draft through mapping, validation, and confirm.
type Reconciliation struct {
	ID                 string          `bson:"_id" json:"id"`
	Status             string          `bson:"status" json:"status"`
	CurrentStep        int             `bson:"currentStep" json:"currentStep"`
	FileName           string          `bson:"fileName" json:"fileName"`
	FileSizeBytes      int64           `bson:"fileSizeBytes" json:"fileSizeBytes"`
	InvoiceNo          string          `bson:"invoiceNo" json:"invoiceNo"`
	Distributor        string          `bson:"distributor" json:"distributor"`
	IssuedAt           string          `bson:"issuedAt" json:"issuedAt"`
	ReceivedAt         string          `bson:"receivedAt" json:"receivedAt"`
	WarehouseLabel     string          `bson:"warehouseLabel" json:"warehouseLabel"`
	DiscountRial       int64           `bson:"discountRial" json:"discountRial"`
	VatRial            int64           `bson:"vatRial" json:"vatRial"`
	TemplateID         string          `bson:"templateId" json:"templateId"`
	Headers            []string        `bson:"headers" json:"headers"`
	ColumnLabels       []string        `bson:"columnLabels" json:"columnLabels"`
	RawRows            [][]string      `bson:"rawRows" json:"-"`
	Mapping            ColumnMapping   `bson:"mapping" json:"mapping"`
	Rows               []ReconciledRow `bson:"rows" json:"rows"`
	QuarantineOnIntake bool            `bson:"quarantineOnIntake" json:"quarantineOnIntake"`
	CreatedReceiptID   string          `bson:"createdReceiptId,omitempty" json:"createdReceiptId,omitempty"`
	CreatedBatchIDs    []string        `bson:"createdBatchIds,omitempty" json:"createdBatchIds,omitempty"`
	CreatedBy          CreatedBy       `bson:"createdBy" json:"createdBy"`
	CreatedAt          time.Time       `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time       `bson:"updatedAt" json:"updatedAt"`
	ConfirmedAt        *time.Time      `bson:"confirmedAt,omitempty" json:"confirmedAt,omitempty"`
}
