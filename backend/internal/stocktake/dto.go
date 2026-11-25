package stocktake

import "time"

type CreateCycleRequest struct {
	Zone           string `json:"zone"`
	Method         string `json:"method"`
	CounterName    string `json:"counterName"`
	SupervisorName string `json:"supervisorName"`
	Note           string `json:"note"`
}

type UpdateSettingsRequest struct {
	Method         *string `json:"method"`
	CounterName    *string `json:"counterName"`
	SupervisorName *string `json:"supervisorName"`
	Note           *string `json:"note"`
}

type RecordItemRequest struct {
	Action             string  `json:"action"` // count | skip | recount | verify | note
	PhysicalQty        *int    `json:"physicalQty"`
	VarianceReason     *string `json:"varianceReason"`
	SupervisorVerified *bool   `json:"supervisorVerified"`
}

type ConfirmCycleRequest struct {
	SupervisorName    string `json:"supervisorName"`
	Note              string `json:"note"`
	SupervisorConfirm bool   `json:"supervisorConfirm"`
}

type CycleSummary struct {
	TotalItems         int     `json:"totalItems"`
	CountedItems       int     `json:"countedItems"`
	SkippedItems       int     `json:"skippedItems"`
	PendingItems       int     `json:"pendingItems"`
	ProgressPct        float64 `json:"progressPct"`
	ShortageUnits      int     `json:"shortageUnits"`
	ShortageItemsCount int     `json:"shortageItemsCount"`
	SurplusUnits       int     `json:"surplusUnits"`
	SurplusItemsCount  int     `json:"surplusItemsCount"`
	MatchedItemsCount  int     `json:"matchedItemsCount"`
	HighVarianceCount  int     `json:"highVarianceCount"`
	NetVarianceRial    int64   `json:"netVarianceRial"`
}

type CycleItemDTO struct {
	ID                 string `json:"id"`
	BatchID            string `json:"batchId"`
	DrugID             string `json:"drugId"`
	NameFa             string `json:"nameFa"`
	NameEn             string `json:"nameEn,omitempty"`
	GTIN               string `json:"gtin,omitempty"`
	GenericCode        string `json:"genericCode,omitempty"`
	Manufacturer       string `json:"manufacturer,omitempty"`
	BatchNo            string `json:"batchNo"`
	Expiry             string `json:"expiry"`
	Zone               string `json:"zone"`
	BinID              string `json:"binId"`
	LocationLabel      string `json:"locationLabel"`
	UnitLabel          string `json:"unitLabel"`
	IsControlled       bool   `json:"isControlled"`
	UnitPriceRial      int64  `json:"unitPriceRial"`
	SystemQty          *int   `json:"systemQty,omitempty"`
	PhysicalQty        *int   `json:"physicalQty,omitempty"`
	VarianceQty        *int   `json:"varianceQty,omitempty"`
	VarianceRial       *int64 `json:"varianceRial,omitempty"`
	VarianceType       string `json:"varianceType"` // pending | skipped | match | shortage | surplus
	RequiresSupervisor bool   `json:"requiresSupervisor"`
	CountStatus        string `json:"countStatus"`
	VarianceReason     string `json:"varianceReason,omitempty"`
	SupervisorVerified bool   `json:"supervisorVerified"`
	CountedAt          string `json:"countedAt,omitempty"`
	CountedBy          string `json:"countedBy,omitempty"`
}

type CycleView struct {
	ID              string         `json:"id"`
	CycleCode       string         `json:"cycleCode"`
	Status          string         `json:"status"`
	Zone            string         `json:"zone"`
	ZoneLabel       string         `json:"zoneLabel"`
	Method          string         `json:"method"`
	CounterName     string         `json:"counterName"`
	SupervisorName  string         `json:"supervisorName"`
	AdjustmentDocNo string         `json:"adjustmentDocNo,omitempty"`
	Note            string         `json:"note,omitempty"`
	Summary         CycleSummary   `json:"summary"`
	Items           []CycleItemDTO `json:"items"`
	CreatedBy       CreatedBy      `json:"createdBy"`
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
	ConfirmedAt     string         `json:"confirmedAt,omitempty"`
}

type CycleListItem struct {
	ID              string       `json:"id"`
	CycleCode       string       `json:"cycleCode"`
	Status          string       `json:"status"`
	Zone            string       `json:"zone"`
	ZoneLabel       string       `json:"zoneLabel"`
	Method          string       `json:"method"`
	CounterName     string       `json:"counterName"`
	SupervisorName  string       `json:"supervisorName"`
	AdjustmentDocNo string       `json:"adjustmentDocNo,omitempty"`
	Summary         CycleSummary `json:"summary"`
	CreatedAt       string       `json:"createdAt"`
	UpdatedAt       string       `json:"updatedAt"`
	ConfirmedAt     string       `json:"confirmedAt,omitempty"`
}

func computeSummary(items []CycleItem) CycleSummary {
	var s CycleSummary
	s.TotalItems = len(items)
	for _, it := range items {
		switch it.CountStatus {
		case ItemStatusCounted:
			s.CountedItems++
			if it.PhysicalQty != nil {
				diff := *it.PhysicalQty - it.SystemQty
				val := int64(diff) * it.UnitPriceRial
				s.NetVarianceRial += val
				absVal := val
				if absVal < 0 {
					absVal = -absVal
				}
				if absVal > HighVarianceThresholdRial {
					s.HighVarianceCount++
				}
				switch {
				case diff < 0:
					s.ShortageItemsCount++
					s.ShortageUnits += -diff
				case diff > 0:
					s.SurplusItemsCount++
					s.SurplusUnits += diff
				default:
					s.MatchedItemsCount++
				}
			}
		case ItemStatusSkipped:
			s.SkippedItems++
		default:
			s.PendingItems++
		}
	}
	if s.TotalItems > 0 {
		s.ProgressPct = float64(s.CountedItems*1000/s.TotalItems) / 10.0
	}
	return s
}

func toItemDTO(it CycleItem, hideSystem bool) CycleItemDTO {
	dto := CycleItemDTO{
		ID:                 it.ID,
		BatchID:            it.BatchID,
		DrugID:             it.DrugID,
		NameFa:             it.NameFa,
		NameEn:             it.NameEn,
		GTIN:               it.GTIN,
		GenericCode:        it.GenericCode,
		Manufacturer:       it.Manufacturer,
		BatchNo:            it.BatchNo,
		Expiry:             it.Expiry,
		Zone:               it.Zone,
		BinID:              it.BinID,
		LocationLabel:      it.LocationLabel,
		UnitLabel:          it.UnitLabel,
		IsControlled:       it.IsControlled,
		UnitPriceRial:      it.UnitPriceRial,
		PhysicalQty:        it.PhysicalQty,
		VarianceType:       it.CountStatus,
		CountStatus:        it.CountStatus,
		VarianceReason:     it.VarianceReason,
		SupervisorVerified: it.SupervisorVerified,
		CountedBy:          it.CountedBy,
	}
	if it.CountedAt != nil {
		dto.CountedAt = it.CountedAt.UTC().Format(time.RFC3339)
	}
	// Reveal systemQty when open mode, confirmed, or the item has already been counted.
	if !hideSystem || it.CountStatus == ItemStatusCounted {
		sys := it.SystemQty
		dto.SystemQty = &sys
	}
	if it.CountStatus == ItemStatusCounted && it.PhysicalQty != nil {
		diff := *it.PhysicalQty - it.SystemQty
		val := int64(diff) * it.UnitPriceRial
		dto.VarianceQty = &diff
		dto.VarianceRial = &val
		absVal := val
		if absVal < 0 {
			absVal = -absVal
		}
		dto.RequiresSupervisor = absVal > HighVarianceThresholdRial
		switch {
		case diff < 0:
			dto.VarianceType = "shortage"
		case diff > 0:
			dto.VarianceType = "surplus"
		default:
			dto.VarianceType = "match"
		}
	}
	return dto
}

func toView(c Cycle) CycleView {
	hideSystem := c.Method == MethodBlind && c.Status != StatusConfirmed
	items := make([]CycleItemDTO, 0, len(c.Items))
	for _, it := range c.Items {
		items = append(items, toItemDTO(it, hideSystem))
	}
	v := CycleView{
		ID:              c.ID,
		CycleCode:       c.CycleCode,
		Status:          c.Status,
		Zone:            c.Zone,
		ZoneLabel:       c.ZoneLabel,
		Method:          c.Method,
		CounterName:     c.CounterName,
		SupervisorName:  c.SupervisorName,
		AdjustmentDocNo: c.AdjustmentDocNo,
		Note:            c.Note,
		Summary:         computeSummary(c.Items),
		Items:           items,
		CreatedBy:       c.CreatedBy,
		CreatedAt:       c.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:       c.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if c.ConfirmedAt != nil {
		v.ConfirmedAt = c.ConfirmedAt.UTC().Format(time.RFC3339)
	}
	return v
}

func toListItem(c Cycle) CycleListItem {
	item := CycleListItem{
		ID:              c.ID,
		CycleCode:       c.CycleCode,
		Status:          c.Status,
		Zone:            c.Zone,
		ZoneLabel:       c.ZoneLabel,
		Method:          c.Method,
		CounterName:     c.CounterName,
		SupervisorName:  c.SupervisorName,
		AdjustmentDocNo: c.AdjustmentDocNo,
		Summary:         computeSummary(c.Items),
		CreatedAt:       c.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:       c.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if c.ConfirmedAt != nil {
		item.ConfirmedAt = c.ConfirmedAt.UTC().Format(time.RFC3339)
	}
	return item
}
