package drug

import "time"

type Drug struct {
	ID            string  `bson:"_id" json:"id"`
	NameFa        string  `bson:"nameFa" json:"nameFa"`
	BrandName     string  `bson:"brandName" json:"brandName"`
	DosageForm    string  `bson:"dosageForm" json:"dosageForm"`
	Strength      string  `bson:"strength" json:"strength"`
	GTIN          string  `bson:"gtin" json:"gtin"`
	GenericCode   string  `bson:"genericCode" json:"genericCode"`
	Manufacturer  string  `bson:"manufacturer" json:"manufacturer"`
	Category      string  `bson:"category" json:"category"`
	IsControlled  bool    `bson:"isControlled" json:"isControlled"`
	TotalStock    int     `bson:"totalStock" json:"totalStock"`
	ReorderLevel  int     `bson:"reorderLevel" json:"reorderLevel"`
	NearestExpiry string  `bson:"nearestExpiry" json:"nearestExpiry"`
	ATCCode       string  `bson:"atcCode,omitempty" json:"atcCode,omitempty"`
	StorageTemp   string  `bson:"storageTemp,omitempty" json:"storageTemp,omitempty"`
	NameNorm      string  `bson:"nameNorm" json:"-"`
	TargetStock   int     `bson:"targetStock,omitempty" json:"targetStock,omitempty"`
	AvgDailyUsage float64 `bson:"avgDailyUsage,omitempty" json:"avgDailyUsage,omitempty"`
	PackSize      int     `bson:"packSize,omitempty" json:"packSize,omitempty"`
	UnitCost      int     `bson:"unitCost,omitempty" json:"unitCost,omitempty"`
	DistributorID string  `bson:"distributorId,omitempty" json:"distributorId,omitempty"`
	LeadTimeDays  int     `bson:"leadTimeDays,omitempty" json:"leadTimeDays,omitempty"`
	UnitLabel     string  `bson:"unitLabel,omitempty" json:"unitLabel,omitempty"`
}

type TtacProduct struct {
	NameFa               string `bson:"nameFa" json:"nameFa"`
	BrandName            string `bson:"brandName" json:"brandName"`
	DosageForm           string `bson:"dosageForm" json:"dosageForm"`
	Strength             string `bson:"strength" json:"strength"`
	GTIN                 string `bson:"gtin" json:"gtin"`
	IRC                  string `bson:"irc,omitempty" json:"irc,omitempty"`
	GenericCode          string `bson:"genericCode" json:"genericCode"`
	Manufacturer         string `bson:"manufacturer" json:"manufacturer"`
	ATCCode              string `bson:"atcCode" json:"atcCode"`
	LicenseExpiry        string `bson:"licenseExpiry" json:"licenseExpiry"`
	Category             string `bson:"category" json:"category"`
	StatusStr            string `bson:"statusStr,omitempty" json:"statusStr,omitempty"`
	PackageConsumerPrice int64  `bson:"packageConsumerPrice,omitempty" json:"packageConsumerPrice,omitempty"`
	FromCache            bool   `bson:"-" json:"fromCache,omitempty"`
}

type TtacCache struct {
	ID          string      `bson:"_id"`
	IRC         string      `bson:"irc,omitempty"`
	GTIN        string      `bson:"gtin,omitempty"`
	GenericCode string      `bson:"genericCode,omitempty"`
	Product     TtacProduct `bson:"product"`
	FetchedAt   time.Time   `bson:"fetchedAt"`
	RawStatus   int         `bson:"rawStatus,omitempty"`
}

// TTACCacheID is the ttac_cache document id: irc:<irc> when IRC is known, otherwise gtin:<gtin>.
func TTACCacheID(irc, gtin string) string {
	if irc != "" {
		return "irc:" + irc
	}
	return "gtin:" + gtin
}
