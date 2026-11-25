package inventory

type KPIs struct {
	TotalSkus             int     `json:"totalSkus"`
	CatalogTotalSkus      int     `json:"catalogTotalSkus"`
	ActiveCategories      int     `json:"activeCategories"`
	DemandCoveragePct     float64 `json:"demandCoveragePct"`
	BelowRopCount         int     `json:"belowRopCount"`
	CriticalShortageCount int     `json:"criticalShortageCount"`
	AvgLeadTimeDays       float64 `json:"avgLeadTimeDays"`
	NearExpiryCount       int     `json:"nearExpiryCount"`
	CriticalExpiryCount   int     `json:"criticalExpiryCount"`
	NearExpiryValueRial   int64   `json:"nearExpiryValueRial"`
	TotalValuationRial    int64   `json:"totalValuationRial"`
	TotalUnits            int     `json:"totalUnits"`
	ActiveBatchCount      int     `json:"activeBatchCount"`
	LastAuditISO          string  `json:"lastAuditISO"`
}

type InventoryRow struct {
	BatchID           string `json:"batchId"`
	DrugID            string `json:"drugId"`
	NameFa            string `json:"nameFa"`
	BrandName         string `json:"brandName"`
	DosageForm        string `json:"dosageForm"`
	Strength          string `json:"strength"`
	GenericCode       string `json:"genericCode"`
	GTIN              string `json:"gtin"`
	Category          string `json:"category"`
	IsControlled      bool   `json:"isControlled"`
	StorageTemp       string `json:"storageTemp"`
	BatchNo           string `json:"batchNo"`
	Expiry            string `json:"expiry"`
	DaysUntilExpiry   int    `json:"daysUntilExpiry"`
	ExpiryBucket      string `json:"expiryBucket"`
	Quantity          int    `json:"quantity"`
	DrugUsableStock   int    `json:"drugUsableStock"`
	ReorderLevel      int    `json:"reorderLevel"`
	UnitLabel         string `json:"unitLabel"`
	BinID             string `json:"binId"`
	LocationLabel     string `json:"locationLabel"`
	Zone              string `json:"zone"`
	BatchStatus       string `json:"batchStatus"`
	InventoryStatus   string `json:"inventoryStatus"`
	BuyPriceRial      int    `json:"buyPriceRial"`
	ConsumerPriceRial int    `json:"consumerPriceRial"`
	RowValueRial      int64  `json:"rowValueRial"`
}

type DashboardResponse struct {
	TodayISO  string         `json:"todayISO"`
	KPIs      KPIs           `json:"kpis"`
	Items     []InventoryRow `json:"items"`
	Total     int            `json:"total"`
	Page      int            `json:"page"`
	PageSize  int            `json:"pageSize"`
	PageCount int            `json:"pageCount"`
}
