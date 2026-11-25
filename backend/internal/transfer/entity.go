package transfer

import "time"

const (
	StatusDraft      = "draft"
	StatusConfirming = "confirming"
	StatusConfirmed  = "confirmed"
	StatusCancelled  = "cancelled"
)

type Header struct {
	Reason       string `bson:"reason" json:"reason"`
	SourceZone   string `bson:"sourceZone" json:"sourceZone"`
	DestZone     string `bson:"destZone" json:"destZone"`
	SourceLabel  string `bson:"sourceLabel" json:"sourceLabel"`
	DestLabel    string `bson:"destLabel" json:"destLabel"`
	Note         string `bson:"note,omitempty" json:"note,omitempty"`
	ReceiverName string `bson:"receiverName,omitempty" json:"receiverName,omitempty"`
}

type Line struct {
	ID                  string `bson:"id" json:"id"`
	DrugID              string `bson:"drugId" json:"drugId"`
	NameFa              string `bson:"nameFa" json:"nameFa"`
	BatchNo             string `bson:"batchNo" json:"batchNo"`
	Expiry              string `bson:"expiry" json:"expiry"`
	SourceBatchID       string `bson:"sourceBatchId" json:"sourceBatchId"`
	SourceBinID         string `bson:"sourceBinId,omitempty" json:"sourceBinId,omitempty"`
	SourceLocationLabel string `bson:"sourceLocationLabel" json:"sourceLocationLabel"`
	DestBinID           string `bson:"destBinId,omitempty" json:"destBinId,omitempty"`
	DestLocationLabel   string `bson:"destLocationLabel,omitempty" json:"destLocationLabel,omitempty"`
	Quantity            int    `bson:"quantity" json:"quantity"`
	UnitLabel           string `bson:"unitLabel" json:"unitLabel"`
	MatchStatus         string `bson:"matchStatus" json:"matchStatus"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type Transfer struct {
	ID             string     `bson:"_id" json:"id"`
	Status         string     `bson:"status" json:"status"`
	CurrentStep    int        `bson:"currentStep" json:"currentStep"`
	Header         Header     `bson:"header" json:"header"`
	Lines          []Line     `bson:"lines" json:"lines"`
	TransferNo     string     `bson:"transferNo,omitempty" json:"transferNo,omitempty"`
	ResultBatchIDs []string   `bson:"resultBatchIds,omitempty" json:"resultBatchIds,omitempty"`
	CreatedBy      CreatedBy  `bson:"createdBy" json:"createdBy"`
	CreatedAt      time.Time  `bson:"createdAt" json:"-"`
	UpdatedAt      time.Time  `bson:"updatedAt" json:"-"`
	ConfirmedAt    *time.Time `bson:"confirmedAt,omitempty" json:"-"`
}
