package ttac

import "testing"

func TestClassifyQuery(t *testing.T) {
	kind, n := ClassifyQuery(" 5281752637952018 ")
	if kind != QueryIRC || n != "5281752637952018" {
		t.Fatalf("irc: %v %q", kind, n)
	}
	kind, n = ClassifyQuery("06260166801277")
	if kind != QueryGTIN || n != "06260166801277" {
		t.Fatalf("gtin: %v %q", kind, n)
	}
	kind, n = ClassifyQuery("آزارام")
	if kind != QueryText || n != "آزارام" {
		t.Fatalf("text: %v %q", kind, n)
	}
}
