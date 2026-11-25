package dispensing

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/controlled"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

const (
	validationMessage      = "لطفاً فیلدهای الزامی را تکمیل کنید"
	noStockMessage         = "موجودی قابل استفاده برای این دارو یافت نشد"
	conflictMessage        = "فقط پیش‌نویس قابل ویرایش است"
	confirmConflictMessage = "فقط پیش‌نویس قابل تایید است"
	defaultTechnicalFee    = int64(50000)
)

type orderStore interface {
	Insert(ctx context.Context, order Order) error
	Get(ctx context.Context, id string) (*Order, error)
	List(ctx context.Context, status string, page, pageSize int) ([]Order, int64, error)
	Replace(ctx context.Context, order Order) error
}

type drugStore interface {
	Get(ctx context.Context, id string) (*drug.Drug, error)
	FindByGTIN(ctx context.Context, gtin string, excludeID string) (*drug.Drug, error)
}

type shelfStore interface {
	BatchesByDrug(ctx context.Context, drugID string) ([]shelf.StockBatch, error)
	GetBatch(ctx context.Context, id string) (*shelf.StockBatch, error)
	GetBin(ctx context.Context, id string) (*shelf.Bin, error)
	UpdateBatchQuantity(ctx context.Context, id string, quantity int) error
	UpdateBatchStatus(ctx context.Context, id, status string) error
}

type cardexWriter interface {
	Append(ctx context.Context, in cardex.AppendInput) (cardex.Movement, error)
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

type controlledLedgerRecorder interface {
	RecordFromDispensing(ctx context.Context, in controlled.DispenseHookInput) error
}

var (
	_ orderStore   = (*Repository)(nil)
	_ drugStore    = (*drug.Repository)(nil)
	_ shelfStore   = (*shelf.Repository)(nil)
	_ cardexWriter = (*cardex.Service)(nil)
	_ auditWriter  = (*audit.Service)(nil)
)

type Service struct {
	repo             orderStore
	drugs            drugStore
	stock            shelfStore
	cardex           cardexWriter
	audit            auditWriter
	controlledLedger controlledLedgerRecorder
	now              func() time.Time
}

func NewService(repo orderStore, drugs drugStore, stock shelfStore, movements cardexWriter, auditLog auditWriter) *Service {
	return &Service{
		repo:   repo,
		drugs:  drugs,
		stock:  stock,
		cardex: movements,
		audit:  auditLog,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) SetControlledLedger(recorder controlledLedgerRecorder) {
	s.controlledLedger = recorder
}

func (s *Service) Create(ctx context.Context, patient Patient, fees *Fees, actor requestctx.Actor) (View, error) {
	patient = normalizePatient(patient)
	resolved := Fees{TechnicalFee: defaultTechnicalFee}
	if fees != nil {
		if fields := feeFields(fees.TechnicalFee, fees.InsuranceCover); len(fields) > 0 {
			return View{}, errormap.Validation(validationMessage, fields)
		}
		resolved = *fees
	}
	now := s.now()
	order := Order{
		ID:      uuid.NewString(),
		Status:  StatusDraft,
		Patient: patient,
		Lines:   []Line{},
		Fees:    resolved,
		CreatedBy: CreatedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Insert(ctx, order); err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) Get(ctx context.Context, id string) (View, error) {
	order, err := s.load(ctx, id)
	if err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) List(ctx context.Context, status string, p pagination.Params) (pagination.Result[View], error) {
	items, total, err := s.repo.List(ctx, status, p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[View]{}, err
	}
	views := make([]View, 0, len(items))
	for _, order := range items {
		views = append(views, toView(order))
	}
	return pagination.Wrap(views, int(total), p.Page, p.PageSize), nil
}

func (s *Service) Patch(ctx context.Context, id string, patch PatientFeesPatch) (View, error) {
	order, err := s.loadDraft(ctx, id)
	if err != nil {
		return View{}, err
	}
	if patch.Patient != nil {
		applyPatient(&order.Patient, *patch.Patient)
	}
	if patch.Fees != nil {
		if patch.Fees.TechnicalFee != nil {
			order.Fees.TechnicalFee = *patch.Fees.TechnicalFee
		}
		if patch.Fees.InsuranceCover != nil {
			order.Fees.InsuranceCover = *patch.Fees.InsuranceCover
		}
		if fields := feeFields(order.Fees.TechnicalFee, order.Fees.InsuranceCover); len(fields) > 0 {
			return View{}, errormap.Validation(validationMessage, fields)
		}
	}
	order.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, order); err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) AddLine(ctx context.Context, orderID string, in LineInput) (View, error) {
	order, err := s.loadDraft(ctx, orderID)
	if err != nil {
		return View{}, err
	}
	d, err := s.resolveDrug(ctx, in)
	if err != nil {
		return View{}, err
	}
	qty := in.Quantity
	if qty == 0 {
		qty = 1
	}
	if qty < 0 {
		return View{}, errormap.Validation(validationMessage, map[string]string{
			"quantity": "تعداد باید بزرگ‌تر از صفر باشد",
		})
	}
	batches, err := s.stock.BatchesByDrug(ctx, d.ID)
	if err != nil {
		return View{}, err
	}
	picked := PickFEFO(batches, true)
	if picked == nil {
		return View{}, errormap.Validation(noStockMessage, map[string]string{
			"drugId": noStockMessage,
		})
	}
	line := Line{ID: uuid.NewString(), Quantity: qty}
	if err := s.applyBatch(ctx, &line, d, *picked, AllocationFEFO, ""); err != nil {
		return View{}, err
	}
	order.Lines = append(order.Lines, line)
	order.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, order); err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) PatchLine(ctx context.Context, orderID, lineID string, patch LinePatch) (View, error) {
	order, err := s.loadDraft(ctx, orderID)
	if err != nil {
		return View{}, err
	}
	idx := lineIndex(order.Lines, lineID)
	if idx < 0 {
		return View{}, errormap.NotFound("قلم حواله یافت نشد")
	}
	line := order.Lines[idx]
	if patch.Quantity != nil {
		if *patch.Quantity <= 0 {
			return View{}, errormap.Validation(validationMessage, map[string]string{
				"quantity": "تعداد باید بزرگ‌تر از صفر باشد",
			})
		}
		line.Quantity = *patch.Quantity
	}
	if patch.BatchID != nil {
		if err := s.applyManualBatch(ctx, &line, patch); err != nil {
			return View{}, err
		}
	} else if patch.ManualReason != nil {
		line.ManualReason = strings.TrimSpace(*patch.ManualReason)
	}
	if patch.Controlled != nil {
		line.Controlled = normalizeControlled(*patch.Controlled)
	}
	order.Lines[idx] = line
	order.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, order); err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) DeleteLine(ctx context.Context, orderID, lineID string) (View, error) {
	order, err := s.loadDraft(ctx, orderID)
	if err != nil {
		return View{}, err
	}
	idx := lineIndex(order.Lines, lineID)
	if idx < 0 {
		return View{}, errormap.NotFound("قلم حواله یافت نشد")
	}
	order.Lines = append(order.Lines[:idx], order.Lines[idx+1:]...)
	if order.Lines == nil {
		order.Lines = []Line{}
	}
	order.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, order); err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) ClearLines(ctx context.Context, orderID string) (View, error) {
	order, err := s.loadDraft(ctx, orderID)
	if err != nil {
		return View{}, err
	}
	order.Lines = []Line{}
	order.UpdatedAt = s.now()
	if err := s.repo.Replace(ctx, order); err != nil {
		return View{}, err
	}
	return toView(order), nil
}

func (s *Service) FEFOPreview(ctx context.Context, drugID string) (shelf.StockBatch, error) {
	id := strings.TrimSpace(drugID)
	if id == "" {
		return shelf.StockBatch{}, errormap.Validation(validationMessage, map[string]string{
			"drugId": "شناسه دارو الزامی است",
		})
	}
	d, err := s.drugs.Get(ctx, id)
	if err != nil {
		return shelf.StockBatch{}, err
	}
	if d == nil {
		return shelf.StockBatch{}, errormap.NotFound("دارو یافت نشد")
	}
	batches, err := s.stock.BatchesByDrug(ctx, d.ID)
	if err != nil {
		return shelf.StockBatch{}, err
	}
	picked := PickFEFO(batches, true)
	if picked == nil {
		return shelf.StockBatch{}, errormap.NotFound(noStockMessage)
	}
	return *picked, nil
}

func (s *Service) Confirm(ctx context.Context, id string, actor requestctx.Actor) (View, error) {
	order, err := s.load(ctx, id)
	if err != nil {
		return View{}, err
	}
	if order.Status != StatusDraft {
		return View{}, errormap.Conflict(confirmConflictMessage)
	}
	if fields := confirmFields(order); len(fields) > 0 {
		return View{}, errormap.Validation(validationMessage, fields)
	}
	fields, err := s.stockFields(ctx, order.Lines)
	if err != nil {
		return View{}, err
	}
	if len(fields) > 0 {
		return View{}, errormap.Validation(validationMessage, fields)
	}

	hasControlled := false
	for _, line := range order.Lines {
		if line.IsControlled {
			hasControlled = true
			break
		}
	}
	action := "dispensing"
	description := "نسخه‌پیچی و ترخیص"
	if hasControlled {
		action = "controlled_dispense"
		description = "نسخه‌پیچی داروی مخدر"
	}
	orderNo := orderNumber(order.ID)
	changes := make([]qtyChange, 0, len(order.Lines))
	for i, line := range order.Lines {
		batch, err := s.stock.GetBatch(ctx, line.BatchID)
		if err != nil {
			s.restoreQuantities(ctx, changes)
			return View{}, err
		}
		if batch == nil || batch.Quantity < line.Quantity {
			s.restoreQuantities(ctx, changes)
			return View{}, errormap.Validation(validationMessage, map[string]string{
				fmt.Sprintf("lines[%d].quantity", i): "موجودی سری ساخت کافی نیست",
			})
		}
		prev := batch.Quantity
		next := prev - line.Quantity
		if err := s.stock.UpdateBatchQuantity(ctx, batch.ID, next); err != nil {
			s.restoreQuantities(ctx, changes)
			return View{}, err
		}
		changes = append(changes, qtyChange{id: batch.ID, prev: prev, prevStatus: batch.Status, zeroed: next <= 0})
		moveType := "dispensing"
		if line.IsControlled {
			moveType = "controlled_dispense"
		}
		if _, err := s.cardex.Append(ctx, cardex.AppendInput{
			DrugID:    line.DrugID,
			Type:      moveType,
			BatchNo:   line.BatchNo,
			QtyOut:    line.Quantity,
			ActorName: actor.Name,
			At:        s.now(),
		}); err != nil {
			s.restoreQuantities(ctx, changes)
			return View{}, err
		}
	}

	now := s.now()
	if _, err := s.audit.Append(ctx, audit.AppendInput{
		Actor: audit.Actor{
			ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials,
		},
		Action:                action,
		EntityType:            "dispense",
		EntityID:              order.ID,
		EntityLabel:           orderNo,
		Description:           description,
		After:                 map[string]any{"orderNo": orderNo, "lineCount": len(order.Lines)},
		BranchID:              actor.BranchID,
		IsControlledSubstance: hasControlled,
	}); err != nil {
		s.restoreQuantities(ctx, changes)
		return View{}, err
	}

	order.Status = StatusConfirmed
	order.OrderNo = orderNo
	order.ConfirmedAt = &now
	order.UpdatedAt = now
	if err := s.repo.Replace(ctx, order); err != nil {
		s.restoreQuantities(ctx, changes)
		return View{}, err
	}
	if s.controlledLedger != nil {
		for _, line := range order.Lines {
			if !line.IsControlled || line.Controlled == nil {
				continue
			}
			_ = s.controlledLedger.RecordFromDispensing(ctx, controlled.DispenseHookInput{
				OrderID:             order.ID,
				OrderNo:             orderNo,
				DrugID:              line.DrugID,
				DrugNameFa:          line.NameFa,
				UnitLabel:           line.UnitLabel,
				Quantity:            line.Quantity,
				BatchID:             line.BatchID,
				BatchNo:             line.BatchNo,
				Expiry:              line.Expiry,
				LocationLabel:       line.LocationLabel,
				PhysicianName:       line.Controlled.PhysicianName,
				PhysicianLicense:    line.Controlled.PhysicianLicense,
				RecipientNationalID: line.Controlled.RecipientNationalID,
				ERxTrackingID:       line.Controlled.ERxTrackingID,
				TechnicalAck:        line.Controlled.TechnicalAck,
				Actor:               actor,
				At:                  now,
			})
		}
	}
	return toView(order), nil
}

type qtyChange struct {
	id         string
	prev       int
	prevStatus string
	zeroed     bool
}

func (s *Service) restoreQuantities(ctx context.Context, changes []qtyChange) {
	for i := len(changes) - 1; i >= 0; i-- {
		change := changes[i]
		_ = s.stock.UpdateBatchQuantity(ctx, change.id, change.prev)
		if change.zeroed {
			_ = s.stock.UpdateBatchStatus(ctx, change.id, change.prevStatus)
		}
	}
}

func (s *Service) stockFields(ctx context.Context, lines []Line) (map[string]string, error) {
	fields := map[string]string{}
	remaining := map[string]int{}
	for i, line := range lines {
		batchID := strings.TrimSpace(line.BatchID)
		if batchID == "" {
			fields[fmt.Sprintf("lines[%d].batchId", i)] = "شناسه سری ساخت الزامی است"
			continue
		}
		batch, err := s.stock.GetBatch(ctx, batchID)
		if err != nil {
			return nil, err
		}
		if batch == nil {
			fields[fmt.Sprintf("lines[%d].batchId", i)] = "سری ساخت یافت نشد"
			continue
		}
		left, seen := remaining[batch.ID]
		if !seen {
			left = batch.Quantity
		}
		if line.Quantity > left {
			fields[fmt.Sprintf("lines[%d].quantity", i)] = "موجودی سری ساخت کافی نیست"
			continue
		}
		remaining[batch.ID] = left - line.Quantity
	}
	return fields, nil
}

func (s *Service) applyManualBatch(ctx context.Context, line *Line, patch LinePatch) error {
	batchID := strings.TrimSpace(*patch.BatchID)
	if batchID == "" {
		return errormap.Validation(validationMessage, map[string]string{
			"batchId": "شناسه سری ساخت الزامی است",
		})
	}
	reason := line.ManualReason
	if patch.ManualReason != nil {
		reason = strings.TrimSpace(*patch.ManualReason)
	}
	if reason == "" {
		return errormap.Validation(validationMessage, map[string]string{
			"manualReason": "دلیل انتخاب دستی الزامی است",
		})
	}
	batch, err := s.stock.GetBatch(ctx, batchID)
	if err != nil {
		return err
	}
	if batch == nil {
		return errormap.NotFound("سری ساخت یافت نشد")
	}
	if batch.DrugID != line.DrugID {
		return errormap.Validation(validationMessage, map[string]string{
			"batchId": "سری ساخت متعلق به این دارو نیست",
		})
	}
	if !usable(*batch) {
		return errormap.Validation(validationMessage, map[string]string{
			"batchId": "سری ساخت قابل خروج نیست",
		})
	}
	d, err := s.drugs.Get(ctx, line.DrugID)
	if err != nil {
		return err
	}
	if d == nil {
		return errormap.NotFound("دارو یافت نشد")
	}
	return s.applyBatch(ctx, line, d, *batch, AllocationManual, reason)
}

func (s *Service) resolveDrug(ctx context.Context, in LineInput) (*drug.Drug, error) {
	if id := strings.TrimSpace(in.DrugID); id != "" {
		d, err := s.drugs.Get(ctx, id)
		if err != nil {
			return nil, err
		}
		if d == nil {
			return nil, errormap.NotFound("دارو یافت نشد")
		}
		return d, nil
	}
	gtin := strings.TrimSpace(in.GTIN)
	if gtin == "" {
		gtin = strings.TrimSpace(in.Barcode)
	}
	if gtin == "" {
		return nil, errormap.Validation(validationMessage, map[string]string{
			"drugId": "شناسه دارو یا بارکد الزامی است",
		})
	}
	d, err := s.drugs.FindByGTIN(ctx, gtin, "")
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, errormap.NotFound("دارو یافت نشد")
	}
	return d, nil
}

func (s *Service) applyBatch(ctx context.Context, line *Line, d *drug.Drug, b shelf.StockBatch, allocation, reason string) error {
	loc, err := s.locationLabel(ctx, b)
	if err != nil {
		return err
	}
	name := strings.TrimSpace(d.NameFa)
	if name == "" {
		name = strings.TrimSpace(b.NameFa)
	}
	manufacturer := strings.TrimSpace(d.Manufacturer)
	if manufacturer == "" {
		manufacturer = strings.TrimSpace(b.Manufacturer)
	}
	line.DrugID = d.ID
	line.NameFa = name
	line.NameEn = strings.TrimSpace(b.NameEn)
	line.Manufacturer = manufacturer
	line.UnitLabel = unitLabel(d, b)
	line.ConsumerPrice = int64(b.ConsumerPriceRial)
	line.BatchID = b.ID
	line.BatchNo = b.BatchNo
	line.Expiry = b.Expiry
	line.LocationLabel = loc
	line.BinID = strings.TrimSpace(b.BinID)
	line.Allocation = allocation
	line.ManualReason = reason
	line.IsColdChain = IsColdChainBatch(b)
	line.IsControlled = d.IsControlled || b.IsControlled
	return nil
}

func (s *Service) locationLabel(ctx context.Context, b shelf.StockBatch) (string, error) {
	if label := strings.TrimSpace(b.LocationLabel); label != "" {
		return label, nil
	}
	binID := strings.TrimSpace(b.BinID)
	if binID == "" {
		return "", nil
	}
	bin, err := s.stock.GetBin(ctx, binID)
	if err != nil {
		return "", err
	}
	if bin == nil {
		return "", nil
	}
	return strings.TrimSpace(bin.Address), nil
}

func (s *Service) load(ctx context.Context, id string) (Order, error) {
	order, err := s.repo.Get(ctx, id)
	if err != nil {
		return Order{}, err
	}
	if order == nil {
		return Order{}, errormap.NotFound("حواله یافت نشد")
	}
	if order.Lines == nil {
		order.Lines = []Line{}
	}
	return *order, nil
}

func (s *Service) loadDraft(ctx context.Context, id string) (Order, error) {
	order, err := s.load(ctx, id)
	if err != nil {
		return Order{}, err
	}
	if order.Status != StatusDraft {
		return Order{}, errormap.Conflict(conflictMessage)
	}
	return order, nil
}

func toView(order Order) View {
	if order.Lines == nil {
		order.Lines = []Line{}
	}
	var goods int64
	cold, controlled := 0, 0
	for _, line := range order.Lines {
		goods += int64(line.Quantity) * line.ConsumerPrice
		if line.IsColdChain {
			cold++
		}
		if line.IsControlled {
			controlled++
		}
	}
	payable := goods + order.Fees.TechnicalFee - order.Fees.InsuranceCover
	if payable < 0 {
		payable = 0
	}
	return View{
		Order:           order,
		GoodsTotal:      goods,
		PatientPayable:  payable,
		LineCount:       len(order.Lines),
		ColdCount:       cold,
		ControlledCount: controlled,
	}
}

func normalizePatient(p Patient) Patient {
	p.NameFa = strings.TrimSpace(p.NameFa)
	p.NationalID = strings.TrimSpace(p.NationalID)
	p.InsuranceLabel = strings.TrimSpace(p.InsuranceLabel)
	p.RxTrackingID = strings.TrimSpace(p.RxTrackingID)
	return p
}

func applyPatient(p *Patient, patch PatientPatch) {
	if patch.NameFa != nil {
		p.NameFa = strings.TrimSpace(*patch.NameFa)
	}
	if patch.NationalID != nil {
		p.NationalID = strings.TrimSpace(*patch.NationalID)
	}
	if patch.InsuranceLabel != nil {
		p.InsuranceLabel = strings.TrimSpace(*patch.InsuranceLabel)
	}
	if patch.RxTrackingID != nil {
		p.RxTrackingID = strings.TrimSpace(*patch.RxTrackingID)
	}
}

func normalizeControlled(in Controlled) *Controlled {
	in.PhysicianName = strings.TrimSpace(in.PhysicianName)
	in.PhysicianLicense = strings.TrimSpace(in.PhysicianLicense)
	in.RecipientNationalID = strings.TrimSpace(in.RecipientNationalID)
	in.ERxTrackingID = strings.TrimSpace(in.ERxTrackingID)
	return &in
}

func feeFields(technical, cover int64) map[string]string {
	fields := map[string]string{}
	if technical < 0 {
		fields["technicalFee"] = "مبلغ نامعتبر است"
	}
	if cover < 0 {
		fields["insuranceCover"] = "مبلغ نامعتبر است"
	}
	return fields
}

func unitLabel(d *drug.Drug, b shelf.StockBatch) string {
	if unit := strings.TrimSpace(b.UnitLabel); unit != "" {
		return unit
	}
	if d != nil {
		if unit := strings.TrimSpace(d.UnitLabel); unit != "" {
			return unit
		}
	}
	return "عدد"
}

func confirmFields(order Order) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(order.Patient.NameFa) == "" {
		fields["nameFa"] = "نام بیمار الزامی است"
	}
	if len(order.Lines) == 0 {
		fields["lines"] = "حداقل یک قلم الزامی است"
	}
	for i, line := range order.Lines {
		prefix := fmt.Sprintf("lines[%d]", i)
		if line.Quantity <= 0 {
			fields[prefix+".quantity"] = "تعداد باید بزرگ‌تر از صفر باشد"
		}
		if line.Allocation == AllocationManual && strings.TrimSpace(line.ManualReason) == "" {
			fields[prefix+".manualReason"] = "دلیل انتخاب دستی الزامی است"
		}
		if !line.IsControlled {
			continue
		}
		if line.Controlled == nil {
			fields[prefix+".controlled"] = "اطلاعات داروی تحت کنترل الزامی است"
			continue
		}
		c := line.Controlled
		if strings.TrimSpace(c.PhysicianName) == "" {
			fields[prefix+".controlled.physicianName"] = "نام پزشک الزامی است"
		}
		if strings.TrimSpace(c.RecipientNationalID) == "" {
			fields[prefix+".controlled.recipientNationalId"] = "کد ملی تحویل‌گیرنده الزامی است"
		}
		if strings.TrimSpace(c.ERxTrackingID) == "" {
			fields[prefix+".controlled.eRxTrackingId"] = "شناسه نسخه الکترونیک الزامی است"
		}
		if !c.TechnicalAck {
			fields[prefix+".controlled.technicalAck"] = "تأیید مسئول فنی الزامی است"
		}
	}
	return fields
}

func orderNumber(id string) string {
	id = strings.TrimSpace(id)
	if len(id) > 5 {
		id = id[len(id)-5:]
	}
	return "OUT-" + id
}

func lineIndex(lines []Line, id string) int {
	for i, line := range lines {
		if line.ID == id {
			return i
		}
	}
	return -1
}
