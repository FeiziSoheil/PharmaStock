package controlled

import (
	"time"

	"pharmastock/backend/pkg/pagination"
)

type EntryDTO struct {
	ID                      string   `json:"id"`
	SeqNo                   int64    `json:"seqNo"`
	Timestamp               string   `json:"timestamp"`
	DrugID                  string   `json:"drugId"`
	DrugNameFa              string   `json:"drugNameFa"`
	DosageStrength          string   `json:"dosageStrength,omitempty"`
	Manufacturer            string   `json:"manufacturer,omitempty"`
	UnitLabel               string   `json:"unitLabel"`
	BatchID                 string   `json:"batchId,omitempty"`
	BatchNo                 string   `json:"batchNo"`
	Expiry                  string   `json:"expiry,omitempty"`
	TxType                  string   `json:"txType"`
	TxSubLabel              string   `json:"txSubLabel"`
	WasteMode               string   `json:"wasteMode,omitempty"`
	QtyIn                   int      `json:"qtyIn"`
	QtyOut                  int      `json:"qtyOut"`
	AmpouleWasteCount       int      `json:"ampouleWasteCount"`
	BalanceAfter            int      `json:"balanceAfter"`
	VaultBinAddress         string   `json:"vaultBinAddress,omitempty"`
	PhysicianName           string   `json:"physicianName,omitempty"`
	PhysicianLicense        string   `json:"physicianLicense,omitempty"`
	PatientNationalIDMasked string   `json:"patientNationalIdMasked,omitempty"`
	PatientNote             string   `json:"patientNote,omitempty"`
	TrackingCode            string   `json:"trackingCode"`
	SepasCode               string   `json:"sepasCode,omitempty"`
	TechnicalAck            bool     `json:"technicalAck"`
	SignedBy                SignedBy `json:"signedBy"`
	Source                  string   `json:"source"`
	RefID                   string   `json:"refId,omitempty"`
}

func ToDTO(e Entry) EntryDTO {
	return EntryDTO{
		ID:                      e.ID,
		SeqNo:                   e.SeqNo,
		Timestamp:               e.Timestamp.UTC().Format(time.RFC3339),
		DrugID:                  e.DrugID,
		DrugNameFa:              e.DrugNameFa,
		DosageStrength:          e.DosageStrength,
		Manufacturer:            e.Manufacturer,
		UnitLabel:               e.UnitLabel,
		BatchID:                 e.BatchID,
		BatchNo:                 e.BatchNo,
		Expiry:                  e.Expiry,
		TxType:                  e.TxType,
		TxSubLabel:              e.TxSubLabel,
		WasteMode:               e.WasteMode,
		QtyIn:                   e.QtyIn,
		QtyOut:                  e.QtyOut,
		AmpouleWasteCount:       e.AmpouleWasteCount,
		BalanceAfter:            e.BalanceAfter,
		VaultBinAddress:         e.VaultBinAddress,
		PhysicianName:           e.PhysicianName,
		PhysicianLicense:        e.PhysicianLicense,
		PatientNationalIDMasked: MaskNationalID(e.PatientNationalID),
		PatientNote:             e.PatientNote,
		TrackingCode:            e.TrackingCode,
		SepasCode:               e.SepasCode,
		TechnicalAck:            e.TechnicalAck,
		SignedBy:                e.SignedBy,
		Source:                  e.Source,
		RefID:                   e.RefID,
	}
}

type CreateRequest struct {
	DrugID            string `json:"drugId"`
	TxType            string `json:"txType"`
	WasteMode         string `json:"wasteMode"`
	Quantity          int    `json:"quantity"`
	BatchID           string `json:"batchId"`
	BatchNo           string `json:"batchNo"`
	Expiry            string `json:"expiry"`
	BinID             string `json:"binId"`
	PhysicianName     string `json:"physicianName"`
	PhysicianLicense  string `json:"physicianLicense"`
	PatientNationalID string `json:"patientNationalId"`
	PatientNote       string `json:"patientNote"`
	TrackingCode      string `json:"trackingCode"`
	SepasCode         string `json:"sepasCode"`
	TechnicalAck      bool   `json:"technicalAck"`
}

type ListQuery struct {
	DrugID   string
	TxType   string
	Search   string
	From     *time.Time
	To       *time.Time
	Page     int
	PageSize int
	SortBy   string
	SortDir  string
}

type ListResponse struct {
	pagination.Result[EntryDTO]
	KPIs       KPIs             `json:"kpis"`
	VaultItems []VaultDrugStock `json:"vaultItems"`
	VaultBins  []VaultBinOption `json:"vaultBins"`
}
