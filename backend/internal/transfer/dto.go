package transfer

// TransferView is JSON-friendly transfer with RFC3339 audit timestamps.
type TransferView struct {
	ID             string    `json:"id"`
	Status         string    `json:"status"`
	CurrentStep    int       `json:"currentStep"`
	Header         Header    `json:"header"`
	Lines          []Line    `json:"lines"`
	TransferNo     string    `json:"transferNo,omitempty"`
	ResultBatchIDs []string  `json:"resultBatchIds,omitempty"`
	CreatedBy      CreatedBy `json:"createdBy"`
	CreatedAt      string    `json:"createdAt"`
	UpdatedAt      string    `json:"updatedAt"`
	ConfirmedAt    string    `json:"confirmedAt,omitempty"`
}

// CreateHeader starts a new draft transfer.
type CreateHeader struct {
	Reason       string `json:"reason"`
	SourceZone   string `json:"sourceZone"`
	DestZone     string `json:"destZone"`
	SourceLabel  string `json:"sourceLabel"`
	DestLabel    string `json:"destLabel"`
	Note         string `json:"note,omitempty"`
	ReceiverName string `json:"receiverName,omitempty"`
}

func (h CreateHeader) toHeader() Header {
	return Header(h)
}

// PatchBody updates draft header fields. Nil fields are left unchanged.
type PatchBody struct {
	Reason       *string `json:"reason"`
	SourceZone   *string `json:"sourceZone"`
	DestZone     *string `json:"destZone"`
	SourceLabel  *string `json:"sourceLabel"`
	DestLabel    *string `json:"destLabel"`
	Note         *string `json:"note"`
	ReceiverName *string `json:"receiverName"`
	CurrentStep  *int    `json:"currentStep"`
}

// AddLineRequest adds a line from a live source batch.
type AddLineRequest struct {
	SourceBatchID       string `json:"sourceBatchId"`
	Quantity            int    `json:"quantity"`
	DestBinID           string `json:"destBinId,omitempty"`
	DestLocationLabel   string `json:"destLocationLabel,omitempty"`
	MatchStatus         string `json:"matchStatus,omitempty"`
}

// PatchLineRequest edits one draft line. Nil fields are left unchanged.
type PatchLineRequest struct {
	Quantity          *int    `json:"quantity"`
	DestBinID         *string `json:"destBinId"`
	DestLocationLabel *string `json:"destLocationLabel"`
	MatchStatus       *string `json:"matchStatus"`
}
