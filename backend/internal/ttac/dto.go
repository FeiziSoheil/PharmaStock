package ttac

type envelope[T any] struct {
	Data      T      `json:"data"`
	Succeeded bool   `json:"succeeded"`
	Message   string `json:"message"`
}

type LicenseDTO struct {
	IndexEnName          string `json:"indexEnName"`
	EnBrandName          string `json:"enBrandName"`
	FaBrandName          string `json:"faBrandName"`
	GTIN                 string `json:"gtin"`
	IRC                  string `json:"irc"`
	ProducerCompanyName  string `json:"producerCompanyName"`
	Status               int    `json:"status"`
	StatusStr            string `json:"statusStr"`
	PackageConsumerPrice int64  `json:"packageConsumerPrice"`
	DrugGenericCode      int64  `json:"drugGenericCode"`
}

type IndexDTO struct {
	ATCCode string `json:"atcCode"`
}

type searchData struct {
	DrugLicenses []LicenseDTO `json:"drugLicenses"`
	Count        int          `json:"count"`
}

type byIRCData struct {
	DrugLicense LicenseDTO `json:"drugLicense"`
	DrugIndex   IndexDTO   `json:"drugIndex"`
	IRCPricing  struct {
		PackageConsumerPrice int64 `json:"packageConsumerPrice"`
		PackageCount         int   `json:"packageCount"`
	} `json:"ircPricing"`
}
