package expiry

import (
	"context"
	"errors"
	"testing"

	"pharmastock/backend/pkg/errormap"
)

func TestCreateBatchCoreValidation(t *testing.T) {
	s := &Service{}
	base := CreateRequest{
		DrugID: "drug-1", BatchNo: "B-1", Expiry: "2027-01-01",
		Quantity: 1, LocationLabel: "A-12",
	}
	cases := []struct {
		name   string
		mutate func(r *CreateRequest)
		field  string
	}{
		{name: "drugId", mutate: func(r *CreateRequest) { r.DrugID = "  " }, field: "drugId"},
		{name: "batchNo", mutate: func(r *CreateRequest) { r.BatchNo = "" }, field: "batchNo"},
		{name: "expiry", mutate: func(r *CreateRequest) { r.Expiry = "" }, field: "expiry"},
		{name: "quantity", mutate: func(r *CreateRequest) { r.Quantity = 0 }, field: "quantity"},
		{name: "location", mutate: func(r *CreateRequest) { r.LocationLabel = ""; r.BinID = "" }, field: "locationLabel"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := base
			tc.mutate(&req)
			_, _, err := s.CreateBatchCore(context.Background(), req, "کاربر")
			var app *errormap.AppError
			if !errors.As(err, &app) {
				t.Fatalf("expected validation error, got %v", err)
			}
			if app.Code != "validation_error" {
				t.Fatalf("code = %s", app.Code)
			}
			fields, ok := app.Fields.(map[string]string)
			if !ok {
				t.Fatalf("fields type %T", app.Fields)
			}
			if _, ok := fields[tc.field]; !ok {
				t.Fatalf("missing %s in %v", tc.field, fields)
			}
		})
	}
}
