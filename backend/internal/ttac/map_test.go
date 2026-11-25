package ttac

import "testing"

func TestMapLicenseTrimsAndMapsIRC(t *testing.T) {
	p := MapLicense(LicenseDTO{
		FaBrandName: "آزارام   قرص خوراکی 50 mg  ",
		EnBrandName: "AZARAM   TABLET ORAL 50 mg  ",
		GTIN:        "06260166801277", IRC: "5281752637952018",
		ProducerCompanyName: "رامو فارمین", Status: 1, StatusStr: "فعال",
		PackageConsumerPrice: 6000000, DrugGenericCode: 122,
	}, &IndexDTO{ATCCode: ""})
	if p.NameFa != "آزارام   قرص خوراکی 50 mg" || p.IRC != "5281752637952018" || p.GenericCode != "122" {
		t.Fatalf("%+v", p)
	}
	if p.DosageForm != "" || p.Category != "" {
		t.Fatalf("must not invent dosage/category: %+v", p)
	}
}

func TestMapLicenseZeroGenericCodeIsEmpty(t *testing.T) {
	p := MapLicense(LicenseDTO{DrugGenericCode: 0, IRC: "5281752637952018"}, nil)
	if p.GenericCode != "" {
		t.Fatalf("zero drugGenericCode must not become %q", p.GenericCode)
	}
}

func TestFilterActive(t *testing.T) {
	in := []SearchHit{{IRC: "1", Status: 1}, {IRC: "2", Status: 2}}
	out := FilterActive(in, false)
	if len(out) != 1 || out[0].IRC != "1" {
		t.Fatalf("%+v", out)
	}
}
