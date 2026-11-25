package controlled

import (
	"strings"
	"time"
)

const (
	TxInDistributor   = "in_distributor"
	TxOutPrescription = "out_prescription"
	TxWasteReturn     = "waste_return"

	WasteModeUsedAmpoule  = "used_ampoule"
	WasteModeDamagedStock = "damaged_stock"

	SourceLedger     = "ledger"
	SourceDispensing = "dispensing"
	SourceReceipt    = "receipt"
	SourceSeed       = "seed"
)

type SignedBy struct {
	UserID    string `bson:"userId" json:"userId"`
	Name      string `bson:"name" json:"name"`
	Role      string `bson:"role" json:"role"`
	LicenseNo string `bson:"licenseNo,omitempty" json:"licenseNo,omitempty"`
}

type Entry struct {
	ID                string    `bson:"_id" json:"id"`
	SeqNo             int64     `bson:"seqNo" json:"seqNo"`
	Timestamp         time.Time `bson:"timestamp" json:"-"`
	DrugID            string    `bson:"drugId" json:"drugId"`
	DrugNameFa        string    `bson:"drugNameFa" json:"drugNameFa"`
	DosageStrength    string    `bson:"dosageStrength,omitempty" json:"dosageStrength,omitempty"`
	Manufacturer      string    `bson:"manufacturer,omitempty" json:"manufacturer,omitempty"`
	UnitLabel         string    `bson:"unitLabel" json:"unitLabel"`
	BatchID           string    `bson:"batchId,omitempty" json:"batchId,omitempty"`
	BatchNo           string    `bson:"batchNo" json:"batchNo"`
	Expiry            string    `bson:"expiry,omitempty" json:"expiry,omitempty"`
	TxType            string    `bson:"txType" json:"txType"`
	TxSubLabel        string    `bson:"txSubLabel" json:"txSubLabel"`
	WasteMode         string    `bson:"wasteMode,omitempty" json:"wasteMode,omitempty"`
	QtyIn             int       `bson:"qtyIn" json:"qtyIn"`
	QtyOut            int       `bson:"qtyOut" json:"qtyOut"`
	AmpouleWasteCount int       `bson:"ampouleWasteCount" json:"ampouleWasteCount"`
	BalanceAfter      int       `bson:"balanceAfter" json:"balanceAfter"`
	VaultBinAddress   string    `bson:"vaultBinAddress,omitempty" json:"vaultBinAddress,omitempty"`
	PhysicianName     string    `bson:"physicianName,omitempty" json:"physicianName,omitempty"`
	PhysicianLicense  string    `bson:"physicianLicense,omitempty" json:"physicianLicense,omitempty"`
	PatientNationalID string    `bson:"patientNationalId,omitempty" json:"-"`
	PatientNote       string    `bson:"patientNote,omitempty" json:"patientNote,omitempty"`
	TrackingCode      string    `bson:"trackingCode" json:"trackingCode"`
	SepasCode         string    `bson:"sepasCode,omitempty" json:"sepasCode,omitempty"`
	TechnicalAck      bool      `bson:"technicalAck" json:"technicalAck"`
	SignedBy          SignedBy  `bson:"signedBy" json:"signedBy"`
	Source            string    `bson:"source" json:"source"`
	RefID             string    `bson:"refId,omitempty" json:"refId,omitempty"`
	SearchNorm        string    `bson:"searchNorm" json:"-"`
}

type VaultDrugStock struct {
	DrugID         string             `json:"drugId"`
	NameFa         string             `json:"nameFa"`
	DosageForm     string             `json:"dosageForm"`
	Strength       string             `json:"strength"`
	Manufacturer   string             `json:"manufacturer"`
	UnitLabel      string             `json:"unitLabel"`
	AvailableStock int                `json:"availableStock"`
	ReorderLevel   int                `json:"reorderLevel"`
	IsLowStock     bool               `json:"isLowStock"`
	VaultAddresses []string           `json:"vaultAddresses"`
	ActiveBatches  []VaultBatchOption `json:"activeBatches"`
}

type VaultBatchOption struct {
	BatchID       string `json:"batchId"`
	BatchNo       string `json:"batchNo"`
	Expiry        string `json:"expiry"`
	Quantity      int    `json:"quantity"`
	BinID         string `json:"binId"`
	LocationLabel string `json:"locationLabel"`
}

type VaultBinOption struct {
	ID        string `json:"id"`
	Address   string `json:"address"`
	Zone      string `json:"zone"`
	ZoneLabel string `json:"zoneLabel"`
}

type KPIs struct {
	TotalVaultBalance       int     `json:"totalVaultBalance"`
	ControlledDrugCount     int     `json:"controlledDrugCount"`
	MonthInflow             int     `json:"monthInflow"`
	MonthInflowShipments    int     `json:"monthInflowShipments"`
	MonthOutflow            int     `json:"monthOutflow"`
	ActivePrescriptionCount int     `json:"activePrescriptionCount"`
	WasteDestroyedCount     int     `json:"wasteDestroyedCount"`
	TotalEntries            int64   `json:"totalEntries"`
	ReconciliationPct       float64 `json:"reconciliationPct"`
	LastAuditAt             string  `json:"lastAuditAt,omitempty"`
}

// MaskNationalID hides middle digits of a 10-digit national ID for display (e.g. 007****583).
func MaskNationalID(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	runes := []rune(s)
	if len(runes) < 6 {
		return s
	}
	return string(runes[:3]) + "****" + string(runes[len(runes)-3:])
}
