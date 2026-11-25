package stocktake

import "time"

const (
	StatusActive     = "active"
	StatusConfirming = "confirming"
	StatusConfirmed  = "confirmed"
	StatusCancelled  = "cancelled"

	MethodBlind = "blind"
	MethodOpen  = "open"

	ItemStatusPending = "pending"
	ItemStatusCounted = "counted"
	ItemStatusSkipped = "skipped"

	HighVarianceThresholdRial = int64(500000)
)

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type CycleItem struct {
	ID                 string     `bson:"id" json:"id"`
	BatchID            string     `bson:"batchId" json:"batchId"`
	DrugID             string     `bson:"drugId" json:"drugId"`
	NameFa             string     `bson:"nameFa" json:"nameFa"`
	NameEn             string     `bson:"nameEn,omitempty" json:"nameEn,omitempty"`
	GTIN               string     `bson:"gtin,omitempty" json:"gtin,omitempty"`
	GenericCode        string     `bson:"genericCode,omitempty" json:"genericCode,omitempty"`
	Manufacturer       string     `bson:"manufacturer,omitempty" json:"manufacturer,omitempty"`
	BatchNo            string     `bson:"batchNo" json:"batchNo"`
	Expiry             string     `bson:"expiry" json:"expiry"`
	Zone               string     `bson:"zone" json:"zone"`
	BinID              string     `bson:"binId" json:"binId"`
	LocationLabel      string     `bson:"locationLabel" json:"locationLabel"`
	UnitLabel          string     `bson:"unitLabel" json:"unitLabel"`
	IsControlled       bool       `bson:"isControlled" json:"isControlled"`
	UnitPriceRial      int64      `bson:"unitPriceRial" json:"unitPriceRial"`
	SystemQty          int        `bson:"systemQty" json:"systemQty"`
	PhysicalQty        *int       `bson:"physicalQty,omitempty" json:"physicalQty,omitempty"`
	CountStatus        string     `bson:"countStatus" json:"countStatus"`
	VarianceReason     string     `bson:"varianceReason,omitempty" json:"varianceReason,omitempty"`
	SupervisorVerified bool       `bson:"supervisorVerified" json:"supervisorVerified"`
	CountedAt          *time.Time `bson:"countedAt,omitempty" json:"countedAt,omitempty"`
	CountedBy          string     `bson:"countedBy,omitempty" json:"countedBy,omitempty"`
}

type Cycle struct {
	ID              string      `bson:"_id" json:"id"`
	CycleCode       string      `bson:"cycleCode" json:"cycleCode"`
	Status          string      `bson:"status" json:"status"`
	Zone            string      `bson:"zone" json:"zone"`
	ZoneLabel       string      `bson:"zoneLabel" json:"zoneLabel"`
	Method          string      `bson:"method" json:"method"`
	CounterName     string      `bson:"counterName" json:"counterName"`
	SupervisorName  string      `bson:"supervisorName" json:"supervisorName"`
	AdjustmentDocNo string      `bson:"adjustmentDocNo,omitempty" json:"adjustmentDocNo,omitempty"`
	Note            string      `bson:"note,omitempty" json:"note,omitempty"`
	Items           []CycleItem `bson:"items" json:"items"`
	CreatedBy       CreatedBy   `bson:"createdBy" json:"createdBy"`
	CreatedAt       time.Time   `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time   `bson:"updatedAt" json:"updatedAt"`
	ConfirmedAt     *time.Time  `bson:"confirmedAt,omitempty" json:"confirmedAt,omitempty"`
}
