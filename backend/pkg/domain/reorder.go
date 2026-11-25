package domain

import "math"

type ReorderUrgency string

const (
	UrgencyCritical ReorderUrgency = "critical"
	UrgencyLow      ReorderUrgency = "low"
	UrgencyReorder  ReorderUrgency = "reorder"
	UrgencyOK       ReorderUrgency = "ok"
)

const (
	UrgencyCriticalDays = 2
	UrgencyLowDays      = 5
	UrgencyReorderDays  = 14
)

type ReorderFormulaMode string

const (
	FormulaModeDrugDefaults ReorderFormulaMode = "drug_defaults"
	FormulaModeDynamicADU   ReorderFormulaMode = "dynamic_adu"
)

type ReorderFormulaConfig struct {
	Mode               ReorderFormulaMode `bson:"mode" json:"mode"`
	SafetyStockDays    int                `bson:"safetyStockDays" json:"safetyStockDays"`
	TargetCoverageDays int                `bson:"targetCoverageDays" json:"targetCoverageDays"`
	DefaultBufferPct   int                `bson:"defaultBufferPct" json:"defaultBufferPct"`
	IncludeOnOrder     bool               `bson:"includeOnOrder" json:"includeOnOrder"`
	RoundToPackSize    bool               `bson:"roundToPackSize" json:"roundToPackSize"`
	CriticalDays       int                `bson:"criticalDays" json:"criticalDays"`
	LowDays            int                `bson:"lowDays" json:"lowDays"`
	ReorderDays        int                `bson:"reorderDays" json:"reorderDays"`
}

func DefaultReorderFormulaConfig() ReorderFormulaConfig {
	return ReorderFormulaConfig{
		Mode:               FormulaModeDrugDefaults,
		SafetyStockDays:    3,
		TargetCoverageDays: 14,
		DefaultBufferPct:   10,
		IncludeOnOrder:     true,
		RoundToPackSize:    true,
		CriticalDays:       UrgencyCriticalDays,
		LowDays:            UrgencyLowDays,
		ReorderDays:        UrgencyReorderDays,
	}
}

func ResolveROPAndTarget(drugReorderLevel, drugTargetStock, leadTimeDays int, avgDailyUsage float64, cfg ReorderFormulaConfig) (int, int) {
	if cfg.Mode == FormulaModeDynamicADU && avgDailyUsage > 0 {
		lead := leadTimeDays
		if lead < 1 {
			lead = 1
		}
		rop := int(math.Ceil(avgDailyUsage * float64(lead+cfg.SafetyStockDays)))
		if rop < 1 {
			rop = 1
		}
		target := int(math.Ceil(avgDailyUsage * float64(lead+cfg.SafetyStockDays+cfg.TargetCoverageDays)))
		if target < rop {
			target = rop
		}
		return rop, target
	}
	rop := drugReorderLevel
	target := drugTargetStock
	if target <= 0 {
		target = rop * 2
	}
	return rop, target
}

type ReorderItemInput struct {
	AvailableStock  int
	ReorderPoint    int
	TargetStock     int
	OnOrderQuantity int
	AvgDailyUsage   float64
	PackSize        int
}

func NeedsReorder(item ReorderItemInput) bool {
	return item.AvailableStock <= item.ReorderPoint
}

func RoundUpToPackSize(quantity, packSize int) int {
	if quantity <= 0 || packSize <= 0 {
		return 0
	}
	return int(math.Ceil(float64(quantity)/float64(packSize))) * packSize
}

func SuggestedQuantity(item ReorderItemInput) int {
	if item.PackSize <= 0 {
		return 0
	}
	raw := item.TargetStock - item.AvailableStock - item.OnOrderQuantity
	if raw < 0 {
		raw = 0
	}
	return RoundUpToPackSize(raw, item.PackSize)
}

func DaysOfCover(item ReorderItemInput) float64 {
	if item.AvgDailyUsage <= 0 {
		return math.Inf(1)
	}
	if item.AvailableStock <= 0 {
		return 0
	}
	return float64(item.AvailableStock) / item.AvgDailyUsage
}

func SuggestedQuantityWithConfig(item ReorderItemInput, cfg ReorderFormulaConfig) int {
	raw := item.TargetStock - item.AvailableStock
	if cfg.IncludeOnOrder {
		raw -= item.OnOrderQuantity
	}
	if raw <= 0 {
		return 0
	}
	if cfg.RoundToPackSize {
		return RoundUpToPackSize(raw, item.PackSize)
	}
	return raw
}

func UrgencyFromDaysOfCover(days float64) ReorderUrgency {
	return UrgencyFromDaysWithThresholds(days, UrgencyCriticalDays, UrgencyLowDays, UrgencyReorderDays)
}

func UrgencyFromDaysWithThresholds(days float64, criticalDays, lowDays, reorderDays int) ReorderUrgency {
	if criticalDays <= 0 {
		criticalDays = UrgencyCriticalDays
	}
	if lowDays < criticalDays {
		lowDays = criticalDays
	}
	if reorderDays < lowDays {
		reorderDays = lowDays
	}
	if math.IsInf(days, 1) || days > float64(reorderDays) {
		return UrgencyOK
	}
	if days <= float64(criticalDays) {
		return UrgencyCritical
	}
	if days <= float64(lowDays) {
		return UrgencyLow
	}
	return UrgencyReorder
}
