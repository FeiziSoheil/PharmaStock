package expiry

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
)

// CreateBatchCore inserts a stock batch and an inbound cardex line.
// Callers own audit; this method does not write an audit event.
// The returned movement id is the cardex row written for this batch.
func (s *Service) CreateBatchCore(ctx context.Context, req CreateRequest, actorName string) (shelf.StockBatch, string, error) {
	fields := map[string]string{}
	if strings.TrimSpace(req.DrugID) == "" {
		fields["drugId"] = "شناسه دارو الزامی است"
	}
	if strings.TrimSpace(req.BatchNo) == "" {
		fields["batchNo"] = "شماره سری ساخت الزامی است"
	}
	if strings.TrimSpace(req.Expiry) == "" {
		fields["expiry"] = "تاریخ انقضا الزامی است"
	}
	if req.Quantity <= 0 {
		fields["quantity"] = "تعداد باید بزرگ‌تر از صفر باشد"
	}
	if strings.TrimSpace(req.LocationLabel) == "" && strings.TrimSpace(req.BinID) == "" {
		fields["locationLabel"] = "محل قفسه الزامی است"
	}
	if len(fields) > 0 {
		return shelf.StockBatch{}, "", errormap.Validation("لطفاً فیلدهای الزامی را تکمیل کنید", fields)
	}

	d, err := s.drugs.Get(ctx, req.DrugID)
	if err != nil {
		return shelf.StockBatch{}, "", err
	}
	if d == nil {
		return shelf.StockBatch{}, "", errormap.NotFound("دارو یافت نشد")
	}

	status := req.Status
	if status == "" {
		status = "active"
	}
	if !allowedStatus[status] {
		return shelf.StockBatch{}, "", errormap.Validation("وضعیت نامعتبر است", map[string]string{"status": "وضعیت مجاز نیست"})
	}

	location := strings.TrimSpace(req.LocationLabel)
	binID := strings.TrimSpace(req.BinID)
	zone := ""
	if binID != "" {
		bin, err := s.shelf.GetBin(ctx, binID)
		if err != nil {
			return shelf.StockBatch{}, "", err
		}
		if bin != nil {
			if location == "" {
				location = bin.Address
			}
			zone = bin.Zone
		}
	}
	if zone == "" && len(location) > 0 {
		zone = string(location[0])
	}

	unit := req.UnitLabel
	if unit == "" {
		unit = d.UnitLabel
	}
	if unit == "" {
		unit = "عدد"
	}
	manufacturer := req.Manufacturer
	if manufacturer == "" {
		manufacturer = d.Manufacturer
	}

	b := shelf.StockBatch{
		ID: uuid.NewString(), DrugID: d.ID, BinID: binID, NameFa: d.NameFa, NameEn: req.NameEn,
		BatchNo: strings.TrimSpace(req.BatchNo), Expiry: strings.TrimSpace(req.Expiry), Quantity: req.Quantity,
		Status: status, UnitLabel: unit, Manufacturer: manufacturer, Distributor: req.Distributor,
		InvoiceNo: req.InvoiceNo, Category: d.Category, IsControlled: d.IsControlled, Zone: zone,
		LocationLabel: location, StorageNote: req.StorageNote, ProductionISO: req.ProductionISO,
		BuyPriceRial: req.BuyPriceRial, ConsumerPriceRial: req.ConsumerPriceRial,
	}
	if err := s.shelf.InsertBatch(ctx, b); err != nil {
		return shelf.StockBatch{}, "", err
	}

	movement, err := s.cardex.Append(ctx, cardex.AppendInput{
		DrugID: b.DrugID, Type: "inbound", BatchNo: b.BatchNo, QtyIn: b.Quantity, QtyOut: 0,
		ActorName: actorName, ShiftLabel: "صبح", Note: "ورود سری ساخت جدید " + b.BatchNo,
	})
	if err != nil {
		_ = s.shelf.DeleteBatch(ctx, b.ID)
		return shelf.StockBatch{}, "", err
	}
	return b, movement.ID, nil
}
