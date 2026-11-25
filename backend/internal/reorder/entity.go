package reorder

import (
	"time"

	"pharmastock/backend/pkg/domain"
)

type Suggestion struct {
	ID                string  `json:"id"`
	DrugID            string  `json:"drugId"`
	NameFa            string  `json:"nameFa"`
	DosageForm        string  `json:"dosageForm"`
	Strength          string  `json:"strength"`
	IRC               string  `json:"irc"`
	DistributorID     string  `json:"distributorId"`
	DistributorNameFa string  `json:"distributorNameFa"`
	Category          string  `json:"category"`
	IsControlled      bool    `json:"isControlled"`
	AvailableStock    int     `json:"availableStock"`
	ReorderPoint      int     `json:"reorderPoint"`
	TargetStock       int     `json:"targetStock"`
	OnOrderQuantity   int     `json:"onOrderQuantity"`
	AvgDailyUsage     float64 `json:"avgDailyUsage"`
	PackSize          int     `json:"packSize"`
	UnitCost          int     `json:"unitCost"`
	UnitLabel         string  `json:"unitLabel"`
	LeadTimeDays      int     `json:"leadTimeDays"`
	SuggestedQty      int     `json:"suggestedQty"`
	DaysOfCover       float64 `json:"daysOfCover"`
	Urgency           string  `json:"urgency"`
	Status            string  `json:"status"`
	StorageTemp       string  `json:"storageTemp,omitempty"`
}

type FormulaSettings struct {
	ID                          string `bson:"_id" json:"-"`
	domain.ReorderFormulaConfig `bson:",inline"`
	UpdatedAt                   time.Time `bson:"updatedAt" json:"updatedAt"`
	UpdatedBy                   string    `bson:"updatedBy,omitempty" json:"updatedBy,omitempty"`
}

type PurchaseOrder struct {
	ID                string              `bson:"_id" json:"id"`
	OrderNumber       string              `bson:"orderNumber" json:"orderNumber"`
	BatchID           string              `bson:"batchId,omitempty" json:"batchId,omitempty"`
	DistributorID     string              `bson:"distributorId" json:"distributorId"`
	DistributorNameFa string              `bson:"distributorNameFa" json:"distributorNameFa"`
	Status            string              `bson:"status" json:"status"`
	BufferPct         int                 `bson:"bufferPct" json:"bufferPct"`
	ItemCount         int                 `bson:"itemCount" json:"itemCount"`
	TotalQty          int                 `bson:"totalQty" json:"totalQty"`
	TotalCost         int                 `bson:"totalCost" json:"totalCost"`
	HasControlled     bool                `bson:"hasControlled" json:"hasControlled"`
	TechnicalConfirm  bool                `bson:"technicalConfirm" json:"technicalConfirm"`
	Notes             string              `bson:"notes,omitempty" json:"notes,omitempty"`
	ActorID           string              `bson:"actorId" json:"actorId"`
	ActorName         string              `bson:"actorName,omitempty" json:"actorName,omitempty"`
	CreatedAt         time.Time           `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time           `bson:"updatedAt" json:"updatedAt"`
	Items             []PurchaseOrderItem `bson:"items" json:"items"`
}

type PurchaseOrderItem struct {
	SuggestionID string `bson:"suggestionId" json:"suggestionId"`
	DrugID       string `bson:"drugId" json:"drugId"`
	NameFa       string `bson:"nameFa,omitempty" json:"nameFa,omitempty"`
	DosageForm   string `bson:"dosageForm,omitempty" json:"dosageForm,omitempty"`
	Strength     string `bson:"strength,omitempty" json:"strength,omitempty"`
	IRC          string `bson:"irc,omitempty" json:"irc,omitempty"`
	UnitLabel    string `bson:"unitLabel,omitempty" json:"unitLabel,omitempty"`
	PackSize     int    `bson:"packSize,omitempty" json:"packSize,omitempty"`
	UnitCost     int    `bson:"unitCost,omitempty" json:"unitCost,omitempty"`
	FinalQty     int    `bson:"finalQty" json:"finalQty"`
	LineTotal    int    `bson:"lineTotal,omitempty" json:"lineTotal,omitempty"`
	IsControlled bool   `bson:"isControlled,omitempty" json:"isControlled,omitempty"`
}

type Dismissed struct {
	ID     string    `bson:"_id"`
	DrugID string    `bson:"drugId"`
	At     time.Time `bson:"at"`
}

type KPIs struct {
	BelowROPCount   int              `json:"belowRopCount"`
	ZeroStockCount  int              `json:"zeroStockCount"`
	EstimatedValue  int              `json:"estimatedValue"`
	AvgLeadTimeDays float64          `json:"avgLeadTimeDays"`
	ByDistributor   []DistributorKPI `json:"byDistributor"`
}

type DistributorKPI struct {
	ID     string `json:"id"`
	NameFa string `json:"nameFa"`
	Count  int    `json:"count"`
}
