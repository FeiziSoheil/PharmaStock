package settings

import (
	"errors"
	"strings"
)

type UpdateSettingsRequest struct {
	PharmacyIdentity PharmacyIdentity `json:"pharmacyIdentity"`
	InventoryRules   InventoryRules   `json:"inventoryRules"`
	TTACIntegration  TTACIntegration  `json:"ttacIntegration"`
	SecurityConfig   SecurityConfig   `json:"securityConfig"`
}

type TestTTACResponse struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latencyMs"`
	Message   string `json:"message"`
	BaseURL   string `json:"baseUrl"`
}

func (r *UpdateSettingsRequest) Validate() error {
	if strings.TrimSpace(r.PharmacyIdentity.NameFa) == "" {
		return errors.New("نام داروخانه الزامی است")
	}
	if strings.TrimSpace(r.PharmacyIdentity.BranchNameFa) == "" {
		return errors.New("نام شعبه الزامی است")
	}
	if r.InventoryRules.CriticalExpiryDays <= 0 || r.InventoryRules.WarningExpiryDays <= 0 || r.InventoryRules.WatchExpiryDays <= 0 {
		return errors.New("روزهای آستانه انقضا باید بزرگتر از صفر باشند")
	}
	if r.InventoryRules.CriticalExpiryDays >= r.InventoryRules.WarningExpiryDays {
		return errors.New("آستانه بحرانی انقضا باید کمتر از آستانه هشدار باشد")
	}
	if r.InventoryRules.WarningExpiryDays >= r.InventoryRules.WatchExpiryDays {
		return errors.New("آستانه هشدار انقضا باید کمتر از آستانه پایش باشد")
	}
	if r.InventoryRules.CriticalCoverDays <= 0 || r.InventoryRules.LowCoverDays <= 0 || r.InventoryRules.ReorderCycleDays <= 0 {
		return errors.New("روزهای پوشش سفارش باید بزرگتر از صفر باشند")
	}
	if r.InventoryRules.SafetyStockFactor < 1.0 {
		return errors.New("ضریب ایمنی سفارش نمی‌تواند کمتر از ۱ باشد")
	}
	if strings.TrimSpace(r.TTACIntegration.BaseURL) == "" {
		return errors.New("آدرس سامانه تیتک الزامی است")
	}
	if r.TTACIntegration.TimeoutMs < 500 {
		return errors.New("حداقل مهلت زمانی تیتک ۵۰۰ میلی‌ثانیه است")
	}
	if r.SecurityConfig.SessionTimeoutHours <= 0 {
		return errors.New("مدت اعتبار نشست باید حداقل ۱ ساعت باشد")
	}
	return nil
}
