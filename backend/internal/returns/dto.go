package returns

import "time"

type EligibilityResponse struct {
	WindowDays int                `json:"windowDays"`
	TodayISO   string             `json:"todayISO"`
	KPIs       SummaryKPIs        `json:"kpis"`
	Groups     []DistributorGroup `json:"groups"`
}

type CreateLineInput struct {
	BatchID  string `json:"batchId"`
	Quantity int    `json:"quantity"`
	Reason   string `json:"reason"`
}

type CreateRequest struct {
	DistributorID string            `json:"distributorId"`
	WindowDays    int               `json:"windowDays"`
	VisitorName   string            `json:"visitorName"`
	Note          string            `json:"note"`
	Lines         []CreateLineInput `json:"lines"`
}

type SettleRequest struct {
	VisitorName  string `json:"visitorName"`
	CreditNoteNo string `json:"creditNoteNo"`
	Note         string `json:"note"`
}

type ReturnView struct {
	DistributorReturn
	CreatedAtISO   string `json:"createdAt"`
	UpdatedAtISO   string `json:"updatedAt"`
	ConfirmedAtISO string `json:"confirmedAt,omitempty"`
	SettledAtISO   string `json:"settledAt,omitempty"`
}

func toView(r DistributorReturn) ReturnView {
	lines := r.Lines
	if lines == nil {
		lines = []ReturnLine{}
	}
	r.Lines = lines
	v := ReturnView{
		DistributorReturn: r,
		CreatedAtISO:      r.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAtISO:      r.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if r.ConfirmedAt != nil {
		v.ConfirmedAtISO = r.ConfirmedAt.UTC().Format(time.RFC3339)
	}
	if r.SettledAt != nil {
		v.SettledAtISO = r.SettledAt.UTC().Format(time.RFC3339)
	}
	return v
}
