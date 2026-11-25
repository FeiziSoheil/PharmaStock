package reconciliation

import "time"

// SummaryKPIs aggregates server-computed counts and Rial totals for a reconciliation.
type SummaryKPIs struct {
	TotalRows               int   `json:"totalRows"`
	MatchedCount            int   `json:"matchedCount"`
	MatchedPercent          int   `json:"matchedPercent"`
	NewItemCount            int   `json:"newItemCount"`
	PriceMismatchCount      int   `json:"priceMismatchCount"`
	UnapprovedMismatchCount int   `json:"unapprovedMismatchCount"`
	GrossRial               int64 `json:"grossRial"`
	DiscountRial            int64 `json:"discountRial"`
	VatRial                 int64 `json:"vatRial"`
	NetRial                 int64 `json:"netRial"`
	CanConfirm              bool  `json:"canConfirm"`
}

// ReconciliationView is the full API payload returned to the client.
type ReconciliationView struct {
	Reconciliation
	Summary SummaryKPIs `json:"summary"`
}

// HistoryItem is a lightweight summary row for the imported invoice history list.
type HistoryItem struct {
	ID                 string      `json:"id"`
	Status             string      `json:"status"`
	CurrentStep        int         `json:"currentStep"`
	FileName           string      `json:"fileName"`
	FileSizeBytes      int64       `json:"fileSizeBytes"`
	InvoiceNo          string      `json:"invoiceNo"`
	Distributor        string      `json:"distributor"`
	TemplateID         string      `json:"templateId"`
	CreatedReceiptID   string      `json:"createdReceiptId,omitempty"`
	QuarantineOnIntake bool        `json:"quarantineOnIntake"`
	CreatedAt          time.Time   `json:"createdAt"`
	UpdatedAt          time.Time   `json:"updatedAt"`
	ConfirmedAt        *time.Time  `json:"confirmedAt,omitempty"`
	Summary            SummaryKPIs `json:"summary"`
}

type UploadMeta struct {
	InvoiceNo      string
	Distributor    string
	IssuedAt       string
	ReceivedAt     string
	WarehouseLabel string
	TemplateID     string
	DiscountRial   int64
	VatRial        int64
}

type MappingRequest struct {
	TemplateID *string        `json:"templateId"`
	Mapping    *ColumnMapping `json:"mapping"`
	GoToStep3  bool           `json:"goToStep3"`
}

type DraftPatch struct {
	InvoiceNo          *string `json:"invoiceNo"`
	Distributor        *string `json:"distributor"`
	IssuedAt           *string `json:"issuedAt"`
	ReceivedAt         *string `json:"receivedAt"`
	WarehouseLabel     *string `json:"warehouseLabel"`
	DiscountRial       *int64  `json:"discountRial"`
	VatRial            *int64  `json:"vatRial"`
	QuarantineOnIntake *bool   `json:"quarantineOnIntake"`
	CurrentStep        *int    `json:"currentStep"`
}

type RowPatch struct {
	DrugID            *string `json:"drugId"`
	ExcelName         *string `json:"excelName"`
	GTIN              *string `json:"gtin"`
	IRC               *string `json:"irc"`
	BatchNo           *string `json:"batchNo"`
	ExpiryRaw         *string `json:"expiryRaw"`
	ExpiryISO         *string `json:"expiryISO"`
	Quantity          *int    `json:"quantity"`
	UnitLabel         *string `json:"unitLabel"`
	BuyPriceRial      *int64  `json:"buyPriceRial"`
	ConsumerPriceRial *int64  `json:"consumerPriceRial"`
	PriceApproved     *bool   `json:"priceApproved"`
	LocationLabel     *string `json:"locationLabel"`
	BinID             *string `json:"binId"`
}

type RematchRequest struct {
	RowID  string `json:"rowId,omitempty"`
	DrugID string `json:"drugId,omitempty"`
}
