package inventory

import (
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
)

type DashboardQuery struct {
	Search      string
	Category    string
	StockStatus string
	StorageTemp string
	SortBy      string
	SortDir     string
	Page        int
	PageSize    int
}

type StockInRequest struct {
	// Optional: link to an existing drug in catalog; if empty, creates a new drug.
	DrugID       string `json:"drugId"`
	NameFa       string `json:"nameFa"`
	BrandName    string `json:"brandName"`
	DosageForm   string `json:"dosageForm"`
	Strength     string `json:"strength"`
	GTIN         string `json:"gtin"`
	GenericCode  string `json:"genericCode"`
	Manufacturer string `json:"manufacturer"`
	Category     string `json:"category"`
	IsControlled bool   `json:"isControlled"`
	ATCCode      string `json:"atcCode"`
	StorageTemp  string `json:"storageTemp"`
	ReorderLevel int    `json:"reorderLevel"`

	// Batch details
	BatchNo           string `json:"batchNo"`
	Expiry            string `json:"expiry"`
	Quantity          int    `json:"quantity"`
	UnitLabel         string `json:"unitLabel"`
	BinID             string `json:"binId"`
	LocationLabel     string `json:"locationLabel"`
	Distributor       string `json:"distributor"`
	InvoiceNo         string `json:"invoiceNo"`
	StorageNote       string `json:"storageNote"`
	BuyPriceRial      int    `json:"buyPriceRial"`
	ConsumerPriceRial int    `json:"consumerPriceRial"`
}

type StockInResponse struct {
	Drug           drug.Drug        `json:"drug"`
	Batch          shelf.StockBatch `json:"batch"`
	CreatedNewDrug bool             `json:"createdNewDrug"`
}

type BulkStatusRequest struct {
	BatchIDs []string `json:"batchIds"`
	Status   string   `json:"status"`
}

type BulkStatusResponse struct {
	UpdatedCount int    `json:"updatedCount"`
	Status       string `json:"status"`
}
