package ttac

import (
	"strconv"
	"strings"
)

type SearchHit struct {
	IRC                  string `json:"irc"`
	GTIN                 string `json:"gtin"`
	NameFa               string `json:"nameFa"`
	BrandName            string `json:"brandName"`
	Manufacturer         string `json:"manufacturer"`
	StatusStr            string `json:"statusStr"`
	Status               int    `json:"status"`
	PackageConsumerPrice int64  `json:"packageConsumerPrice,omitempty"`
}

type MappedProduct struct {
	NameFa, BrandName, DosageForm, Strength, GTIN, IRC, GenericCode, Manufacturer, ATCCode, LicenseExpiry, Category, StatusStr string
	PackageConsumerPrice                                                                                                       int64
	RawStatus                                                                                                                  int
}

func MapLicense(lic LicenseDTO, index *IndexDTO) MappedProduct {
	price := lic.PackageConsumerPrice
	atc := ""
	if index != nil {
		atc = strings.TrimSpace(index.ATCCode)
	}
	genericCode := ""
	if lic.DrugGenericCode != 0 {
		genericCode = strconv.FormatInt(lic.DrugGenericCode, 10)
	}
	return MappedProduct{
		NameFa:               strings.TrimSpace(lic.FaBrandName),
		BrandName:            strings.TrimSpace(lic.EnBrandName),
		GTIN:                 strings.TrimSpace(lic.GTIN),
		IRC:                  strings.TrimSpace(lic.IRC),
		GenericCode:          genericCode,
		Manufacturer:         strings.TrimSpace(lic.ProducerCompanyName),
		ATCCode:              atc,
		StatusStr:            strings.TrimSpace(lic.StatusStr),
		PackageConsumerPrice: price,
		RawStatus:            lic.Status,
	}
}

func MapSearchItem(lic LicenseDTO) SearchHit {
	p := MapLicense(lic, nil)
	return SearchHit{
		IRC: p.IRC, GTIN: p.GTIN, NameFa: p.NameFa, BrandName: p.BrandName,
		Manufacturer: p.Manufacturer, Status: lic.Status, StatusStr: p.StatusStr,
		PackageConsumerPrice: p.PackageConsumerPrice,
	}
}

func FilterActive(hits []SearchHit, includeInactive bool) []SearchHit {
	if includeInactive {
		return hits
	}
	out := make([]SearchHit, 0, len(hits))
	for _, h := range hits {
		if h.Status == 1 {
			out = append(out, h)
		}
	}
	return out
}
