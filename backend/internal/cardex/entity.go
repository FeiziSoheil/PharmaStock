package cardex

import "time"

type Movement struct {
	ID         string    `bson:"_id" json:"id"`
	DrugID     string    `bson:"drugId" json:"drugId"`
	Timestamp  time.Time `bson:"timestamp" json:"-"`
	Type       string    `bson:"type" json:"type"`
	BatchNo    string    `bson:"batchNo" json:"batchNo"`
	QtyIn      int       `bson:"qtyIn" json:"qtyIn"`
	QtyOut     int       `bson:"qtyOut" json:"qtyOut"`
	ActorName  string    `bson:"actorName" json:"actorName"`
	ShiftLabel string    `bson:"shiftLabel,omitempty" json:"shiftLabel,omitempty"`
	Note       string    `bson:"note,omitempty" json:"note,omitempty"`
}

type MovementDTO struct {
	ID           string `json:"id"`
	DrugID       string `json:"drugId"`
	TimestampISO string `json:"timestampISO"`
	Type         string `json:"type"`
	BatchNo      string `json:"batchNo"`
	QtyIn        int    `json:"qtyIn"`
	QtyOut       int    `json:"qtyOut"`
	ActorName    string `json:"actorName"`
	ShiftLabel   string `json:"shiftLabel"`
	Note         string `json:"note"`
}

func ToDTO(m Movement) MovementDTO {
	return MovementDTO{
		ID: m.ID, DrugID: m.DrugID, TimestampISO: m.Timestamp.UTC().Format(time.RFC3339),
		Type: m.Type, BatchNo: m.BatchNo, QtyIn: m.QtyIn, QtyOut: m.QtyOut,
		ActorName: m.ActorName, ShiftLabel: m.ShiftLabel, Note: m.Note,
	}
}
