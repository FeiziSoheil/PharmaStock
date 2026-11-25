package drug

type UpsertRequest struct {
	NameFa       string `json:"nameFa"`
	BrandName    string `json:"brandName"`
	DosageForm   string `json:"dosageForm"`
	Strength     string `json:"strength"`
	GTIN         string `json:"gtin"`
	GenericCode  string `json:"genericCode"`
	Manufacturer string `json:"manufacturer"`
	Category     string `json:"category"`
	IsControlled bool   `json:"isControlled"`
	ATCCode      string `json:"atcCode"`
	StorageTemp  string `json:"storageTemp"`
	ReorderLevel int    `json:"reorderLevel"`
	TargetStock  int    `json:"targetStock"`
	PackSize     int    `json:"packSize"`
}
