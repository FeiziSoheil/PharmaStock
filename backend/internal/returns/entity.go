package returns

import "time"

const (
	StatusDraft      = "draft"
	StatusConfirming = "confirming"
	StatusConfirmed  = "confirmed"
	StatusSettled    = "settled"
	StatusCancelled  = "cancelled"
)

const DefaultWindowDays = 90

type ReturnLine struct {
	ID            string `bson:"id" json:"id"`
	BatchID       string `bson:"batchId" json:"batchId"`
	DrugID        string `bson:"drugId" json:"drugId"`
	NameFa        string `bson:"nameFa" json:"nameFa"`
	DosageForm    string `bson:"dosageForm,omitempty" json:"dosageForm,omitempty"`
	Strength      string `bson:"strength,omitempty" json:"strength,omitempty"`
	Manufacturer  string `bson:"manufacturer,omitempty" json:"manufacturer,omitempty"`
	IRC           string `bson:"irc,omitempty" json:"irc,omitempty"`
	BatchNo       string `bson:"batchNo" json:"batchNo"`
	Expiry        string `bson:"expiry" json:"expiry"`
	Quantity      int    `bson:"quantity" json:"quantity"`
	AvailableQty  int    `bson:"availableQty" json:"availableQty"`
	UnitLabel     string `bson:"unitLabel" json:"unitLabel"`
	BuyPriceRial  int64  `bson:"buyPriceRial" json:"buyPriceRial"`
	LineTotalRial int64  `bson:"lineTotalRial" json:"lineTotalRial"`
	LocationLabel string `bson:"locationLabel,omitempty" json:"locationLabel,omitempty"`
	Reason        string `bson:"reason" json:"reason"`
	IsControlled  bool   `bson:"isControlled" json:"isControlled"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type DistributorReturn struct {
	ID              string       `bson:"_id" json:"id"`
	ReturnNo        string       `bson:"returnNo,omitempty" json:"returnNo,omitempty"`
	Status          string       `bson:"status" json:"status"`
	DistributorID   string       `bson:"distributorId" json:"distributorId"`
	DistributorName string       `bson:"distributorName" json:"distributorName"`
	DistributorCode string       `bson:"distributorCode,omitempty" json:"distributorCode,omitempty"`
	CustomerCode    string       `bson:"customerCode,omitempty" json:"customerCode,omitempty"`
	VisitorName     string       `bson:"visitorName,omitempty" json:"visitorName,omitempty"`
	CreditNoteNo    string       `bson:"creditNoteNo,omitempty" json:"creditNoteNo,omitempty"`
	WindowDays      int          `bson:"windowDays" json:"windowDays"`
	Note            string       `bson:"note,omitempty" json:"note,omitempty"`
	Lines           []ReturnLine `bson:"lines" json:"lines"`
	TotalQty        int          `bson:"totalQty" json:"totalQty"`
	TotalValueRial  int64        `bson:"totalValueRial" json:"totalValueRial"`
	CreatedBy       CreatedBy    `bson:"createdBy" json:"createdBy"`
	CreatedAt       time.Time    `bson:"createdAt" json:"-"`
	UpdatedAt       time.Time    `bson:"updatedAt" json:"-"`
	ConfirmedAt     *time.Time   `bson:"confirmedAt,omitempty" json:"-"`
	SettledAt       *time.Time   `bson:"settledAt,omitempty" json:"-"`
}

type EligibleBatch struct {
	BatchID         string `json:"batchId"`
	DrugID          string `json:"drugId"`
	NameFa          string `json:"nameFa"`
	DosageForm      string `json:"dosageForm,omitempty"`
	Strength        string `json:"strength,omitempty"`
	Manufacturer    string `json:"manufacturer,omitempty"`
	IRC             string `json:"irc,omitempty"`
	BatchNo         string `json:"batchNo"`
	Expiry          string `json:"expiry"`
	DaysUntilExpiry int    `json:"daysUntilExpiry"`
	Quantity        int    `json:"quantity"`
	UnitLabel       string `json:"unitLabel"`
	BuyPriceRial    int64  `json:"buyPriceRial"`
	TotalValueRial  int64  `json:"totalValueRial"`
	Status          string `json:"status"`
	LocationLabel   string `json:"locationLabel,omitempty"`
	DistributorID   string `json:"distributorId"`
	DistributorName string `json:"distributorName"`
	ContractReason  string `json:"contractReason"`
	Urgency         string `json:"urgency"`
	IsControlled    bool   `json:"isControlled"`
}

type DistributorGroup struct {
	DistributorID   string          `json:"distributorId"`
	DistributorName string          `json:"distributorName"`
	DistributorCode string          `json:"distributorCode"`
	CustomerCode    string          `json:"customerCode"`
	VisitorName     string          `json:"visitorName"`
	DepositLocation string          `json:"depositLocation"`
	BatchCount      int             `json:"batchCount"`
	TotalQty        int             `json:"totalQty"`
	TotalValueRial  int64           `json:"totalValueRial"`
	NearestDays     int             `json:"nearestDays"`
	NearestExpiry   string          `json:"nearestExpiry"`
	Items           []EligibleBatch `json:"items"`
}

type SummaryKPIs struct {
	TotalBatches        int      `json:"totalBatches"`
	UrgentBatches       int      `json:"urgentBatches"`
	TotalValueRial      int64    `json:"totalValueRial"`
	ActiveDistributors  int      `json:"activeDistributors"`
	DistributorNames    []string `json:"distributorNames"`
	PendingVisitorSlips int      `json:"pendingVisitorSlips"`
}
