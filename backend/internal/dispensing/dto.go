package dispensing

// View is a dispense order plus totals derived from lines and fees.
type View struct {
	Order
	GoodsTotal      int64 `json:"goodsTotal"`
	PatientPayable  int64 `json:"patientPayable"`
	LineCount       int   `json:"lineCount"`
	ColdCount       int   `json:"coldCount"`
	ControlledCount int   `json:"controlledCount"`
}

// PatientPatch updates draft patient fields. Nil fields are left unchanged.
type PatientPatch struct {
	NameFa         *string `json:"nameFa"`
	NationalID     *string `json:"nationalId"`
	InsuranceLabel *string `json:"insuranceLabel"`
	RxTrackingID   *string `json:"rxTrackingId"`
}

// FeesPatch updates draft fees. Nil fields are left unchanged.
type FeesPatch struct {
	TechnicalFee   *int64 `json:"technicalFee"`
	InsuranceCover *int64 `json:"insuranceCover"`
}

// PatientFeesPatch updates patient and fees on a draft order.
type PatientFeesPatch struct {
	Patient *PatientPatch `json:"patient"`
	Fees    *FeesPatch    `json:"fees"`
}

// CreateRequest opens a draft. A nil Fees pointer applies the default technical fee.
type CreateRequest struct {
	Patient Patient `json:"patient"`
	Fees    *Fees   `json:"fees"`
}

// LineInput adds a draft line by drug id or barcode/GTIN.
type LineInput struct {
	DrugID   string `json:"drugId"`
	Barcode  string `json:"barcode"`
	GTIN     string `json:"gtin"`
	Quantity int    `json:"quantity"`
}

// LinePatch edits one draft line. Nil fields are left unchanged.
type LinePatch struct {
	Quantity     *int        `json:"quantity"`
	BatchID      *string     `json:"batchId"`
	ManualReason *string     `json:"manualReason"`
	Controlled   *Controlled `json:"controlled"`
}
