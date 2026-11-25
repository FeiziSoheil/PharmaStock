package shelf

type Batch struct {
	DrugID   string `bson:"drugId" json:"drugId"`
	NameFa   string `bson:"nameFa" json:"nameFa"`
	BatchNo  string `bson:"batchNo" json:"batchNo"`
	Expiry   string `bson:"expiry" json:"expiry"`
	Quantity int    `bson:"quantity" json:"quantity"`
}

type Bin struct {
	ID            string `bson:"_id" json:"id"`
	Zone          string `bson:"zone" json:"zone"`
	ZoneLabel     string `bson:"zoneLabel" json:"zoneLabel"`
	Rack          string `bson:"rack" json:"rack"`
	Shelf         string `bson:"shelf" json:"shelf"`
	Bin           string `bson:"bin" json:"bin"`
	Address       string `bson:"address" json:"address"`
	IsControlled  bool   `bson:"isControlled" json:"isControlled"`
	Capacity      int    `bson:"capacity" json:"capacity"`
	MacroLocation string `bson:"macroLocation" json:"macroLocation"`
}

type StockBatch struct {
	ID                string `bson:"_id" json:"batchId"`
	DrugID            string `bson:"drugId" json:"drugId"`
	BinID             string `bson:"binId" json:"binId"`
	NameFa            string `bson:"nameFa" json:"nameFa"`
	NameEn            string `bson:"nameEn,omitempty" json:"nameEn,omitempty"`
	BatchNo           string `bson:"batchNo" json:"batchNo"`
	Expiry            string `bson:"expiry" json:"expiry"`
	Quantity          int    `bson:"quantity" json:"quantity"`
	Status            string `bson:"status" json:"status"`
	UnitLabel         string `bson:"unitLabel,omitempty" json:"unitLabel,omitempty"`
	Manufacturer      string `bson:"manufacturer,omitempty" json:"manufacturer,omitempty"`
	Distributor       string `bson:"distributor,omitempty" json:"distributor,omitempty"`
	InvoiceNo         string `bson:"invoiceNo,omitempty" json:"invoiceNo,omitempty"`
	Category          string `bson:"category,omitempty" json:"category,omitempty"`
	IsControlled      bool   `bson:"isControlled" json:"isControlled"`
	Zone              string `bson:"zone,omitempty" json:"zone,omitempty"`
	LocationLabel     string `bson:"locationLabel,omitempty" json:"locationLabel,omitempty"`
	StorageNote       string `bson:"storageNote,omitempty" json:"storageNote,omitempty"`
	ProductionISO     string `bson:"productionISO,omitempty" json:"productionISO,omitempty"`
	BuyPriceRial      int    `bson:"buyPriceRial,omitempty" json:"buyPriceRial,omitempty"`
	ConsumerPriceRial int    `bson:"consumerPriceRial,omitempty" json:"consumerPriceRial,omitempty"`
}

type BinView struct {
	Bin
	Batches []Batch `json:"batches"`
	Status  string  `json:"status,omitempty"`
}

type KPIs struct {
	CapacityPct     float64 `json:"capacityPct"`
	OccupiedBins    int     `json:"occupiedBins"`
	TotalBins       int     `json:"totalBins"`
	EmptyBins       int     `json:"emptyBins"`
	DispensingReady int     `json:"dispensingReady"`
	ReplenishNeeded int     `json:"replenishNeeded"`
	ColdTempC       float64 `json:"coldTempC"`
}
