package settings

import "time"

type PharmacyIdentity struct {
	NameFa             string `bson:"nameFa" json:"nameFa"`
	BranchNameFa       string `bson:"branchNameFa" json:"branchNameFa"`
	BranchID           string `bson:"branchId" json:"branchId"`
	LicenseNumber      string `bson:"licenseNumber" json:"licenseNumber"`
	TechnicalOfficer   string `bson:"technicalOfficer" json:"technicalOfficer"`
	MedicalCouncilNo   string `bson:"medicalCouncilNo" json:"medicalCouncilNo"`
	Phone              string `bson:"phone" json:"phone"`
	Address            string `bson:"address" json:"address"`
	PrintFooterNotice  string `bson:"printFooterNotice" json:"printFooterNotice"`
}

type InventoryRules struct {
	CriticalExpiryDays int     `bson:"criticalExpiryDays" json:"criticalExpiryDays"`
	WarningExpiryDays  int     `bson:"warningExpiryDays" json:"warningExpiryDays"`
	WatchExpiryDays    int     `bson:"watchExpiryDays" json:"watchExpiryDays"`
	CriticalCoverDays  int     `bson:"criticalCoverDays" json:"criticalCoverDays"`
	LowCoverDays       int     `bson:"lowCoverDays" json:"lowCoverDays"`
	ReorderCycleDays   int     `bson:"reorderCycleDays" json:"reorderCycleDays"`
	SafetyStockFactor  float64 `bson:"safetyStockFactor" json:"safetyStockFactor"`
	StrictFEFOEnforced bool    `bson:"strictFefoEnforced" json:"strictFefoEnforced"`
	RequireDualSignOff bool    `bson:"requireDualSignOff" json:"requireDualSignOff"`
}

type TTACIntegration struct {
	BaseURL         string `bson:"baseUrl" json:"baseUrl"`
	TimeoutMs       int    `bson:"timeoutMs" json:"timeoutMs"`
	CacheTTLHours   int    `bson:"cacheTtlHours" json:"cacheTtlHours"`
	LiveLookupActive bool   `bson:"liveLookupActive" json:"liveLookupActive"`
	AutoCacheMisses bool   `bson:"autoCacheMisses" json:"autoCacheMisses"`
}

type SecurityConfig struct {
	SessionTimeoutHours int  `bson:"sessionTimeoutHours" json:"sessionTimeoutHours"`
	AuditAllMutations   bool `bson:"auditAllMutations" json:"auditAllMutations"`
	EnforceStrongPassword bool `bson:"enforceStrongPassword" json:"enforceStrongPassword"`
}

type Settings struct {
	ID               string           `bson:"_id" json:"id"`
	PharmacyIdentity PharmacyIdentity `bson:"pharmacyIdentity" json:"pharmacyIdentity"`
	InventoryRules   InventoryRules   `bson:"inventoryRules" json:"inventoryRules"`
	TTACIntegration  TTACIntegration  `bson:"ttacIntegration" json:"ttacIntegration"`
	SecurityConfig   SecurityConfig   `bson:"securityConfig" json:"securityConfig"`
	UpdatedAt        time.Time        `bson:"updatedAt" json:"updatedAt"`
	UpdatedBy        string           `bson:"updatedBy" json:"updatedBy"`
}

const SingletonID = "singleton"

func DefaultSettings() Settings {
	return Settings{
		ID: SingletonID,
		PharmacyIdentity: PharmacyIdentity{
			NameFa:            "داروخانه دکتر حسینی",
			BranchNameFa:      "شعبه مرکزی",
			BranchID:          "branch-central",
			LicenseNumber:     "PHA-1402-9981",
			TechnicalOfficer:  "دکتر مریم حسینی",
			MedicalCouncilNo:  "د-۱۲۳۴۵",
			Phone:             "۰۲۱-۸۸۷۷۶۶۵۵",
			Address:           "تهران، خیابان ولیعصر، تقاطع فاطمی، پلاک ۱۲",
			PrintFooterNotice: "این برگه سیستمی صادر شده و در انبار مرکزی داروخانه قابل استناد و پیگیری در سامانه ردیابی TTAC است.",
		},
		InventoryRules: InventoryRules{
			CriticalExpiryDays: 30,
			WarningExpiryDays:  90,
			WatchExpiryDays:    180,
			CriticalCoverDays:  2,
			LowCoverDays:       5,
			ReorderCycleDays:   14,
			SafetyStockFactor:  1.2,
			StrictFEFOEnforced: true,
			RequireDualSignOff: true,
		},
		TTACIntegration: TTACIntegration{
			BaseURL:          "https://newapi.ttac.ir",
			TimeoutMs:        5000,
			CacheTTLHours:    24,
			LiveLookupActive: true,
			AutoCacheMisses:  true,
		},
		SecurityConfig: SecurityConfig{
			SessionTimeoutHours:   12,
			AuditAllMutations:     true,
			EnforceStrongPassword: true,
		},
		UpdatedAt: time.Now().UTC(),
		UpdatedBy: "system_init",
	}
}
