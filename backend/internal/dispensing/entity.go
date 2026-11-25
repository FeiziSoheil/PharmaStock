package dispensing

import "time"

const (
	StatusDraft     = "draft"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"

	AllocationFEFO   = "fefo"
	AllocationManual = "manual"
)

type Patient struct {
	NameFa         string `bson:"nameFa" json:"nameFa"`
	NationalID     string `bson:"nationalId,omitempty" json:"nationalId,omitempty"`
	InsuranceLabel string `bson:"insuranceLabel,omitempty" json:"insuranceLabel,omitempty"`
	RxTrackingID   string `bson:"rxTrackingId,omitempty" json:"rxTrackingId,omitempty"`
}

type Controlled struct {
	PhysicianName       string `bson:"physicianName" json:"physicianName"`
	PhysicianLicense    string `bson:"physicianLicense,omitempty" json:"physicianLicense,omitempty"`
	RecipientNationalID string `bson:"recipientNationalId" json:"recipientNationalId"`
	ERxTrackingID       string `bson:"eRxTrackingId" json:"eRxTrackingId"`
	TechnicalAck        bool   `bson:"technicalAck" json:"technicalAck"`
}

type Line struct {
	ID            string      `bson:"id" json:"id"`
	DrugID        string      `bson:"drugId" json:"drugId"`
	NameFa        string      `bson:"nameFa" json:"nameFa"`
	NameEn        string      `bson:"nameEn,omitempty" json:"nameEn,omitempty"`
	IRC           string      `bson:"irc,omitempty" json:"irc,omitempty"`
	Manufacturer  string      `bson:"manufacturer,omitempty" json:"manufacturer,omitempty"`
	UnitLabel     string      `bson:"unitLabel" json:"unitLabel"`
	Quantity      int         `bson:"quantity" json:"quantity"`
	ConsumerPrice int64       `bson:"consumerPrice" json:"consumerPrice"`
	BatchID       string      `bson:"batchId" json:"batchId"`
	BatchNo       string      `bson:"batchNo" json:"batchNo"`
	Expiry        string      `bson:"expiry" json:"expiry"`
	LocationLabel string      `bson:"locationLabel" json:"locationLabel"`
	BinID         string      `bson:"binId,omitempty" json:"binId,omitempty"`
	Allocation    string      `bson:"allocation" json:"allocation"`
	ManualReason  string      `bson:"manualReason,omitempty" json:"manualReason,omitempty"`
	IsColdChain   bool        `bson:"isColdChain" json:"isColdChain"`
	IsControlled  bool        `bson:"isControlled" json:"isControlled"`
	Controlled    *Controlled `bson:"controlled,omitempty" json:"controlled,omitempty"`
}

type Fees struct {
	TechnicalFee   int64 `bson:"technicalFee" json:"technicalFee"`
	InsuranceCover int64 `bson:"insuranceCover" json:"insuranceCover"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type Order struct {
	ID          string     `bson:"_id" json:"id"`
	Status      string     `bson:"status" json:"status"`
	OrderNo     string     `bson:"orderNo,omitempty" json:"orderNo,omitempty"`
	Patient     Patient    `bson:"patient" json:"patient"`
	Lines       []Line     `bson:"lines" json:"lines"`
	Fees        Fees       `bson:"fees" json:"fees"`
	CreatedBy   CreatedBy  `bson:"createdBy" json:"createdBy"`
	CreatedAt   time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time  `bson:"updatedAt" json:"updatedAt"`
	ConfirmedAt *time.Time `bson:"confirmedAt,omitempty" json:"confirmedAt,omitempty"`
}
