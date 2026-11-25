package transfer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

const validationMessage = "لطفاً فیلدهای الزامی را تکمیل کنید"

type transferStore interface {
	Insert(ctx context.Context, t Transfer) error
	Get(ctx context.Context, id string) (*Transfer, error)
	List(ctx context.Context, status string, page, pageSize int) ([]Transfer, int64, error)
	Replace(ctx context.Context, t Transfer) error
	ReplaceIfDraft(ctx context.Context, t Transfer) (bool, error)
	ClaimForConfirm(ctx context.Context, id string) (bool, error)
	RevertToDraft(ctx context.Context, id string) error
}

type shelfStore interface {
	GetBatch(ctx context.Context, id string) (*shelf.StockBatch, error)
	GetBin(ctx context.Context, id string) (*shelf.Bin, error)
	UpdateBatchLocation(ctx context.Context, id, locationLabel, binID, zone string) error
	UpdateBatch(ctx context.Context, b shelf.StockBatch) error
	InsertBatch(ctx context.Context, b shelf.StockBatch) error
	DeleteBatch(ctx context.Context, id string) error
}

type cardexWriter interface {
	Append(ctx context.Context, in cardex.AppendInput) (cardex.Movement, error)
	Delete(ctx context.Context, id string) error
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

var (
	_ transferStore = (*Repository)(nil)
	_ shelfStore    = (*shelf.Repository)(nil)
)

type Service struct {
	repo   transferStore
	shelf  shelfStore
	cardex cardexWriter
	audit  auditWriter
	now    func() time.Time
}

func NewService(repo transferStore, shelf shelfStore, cardex cardexWriter, audit auditWriter) *Service {
	return &Service{
		repo:   repo,
		shelf:  shelf,
		cardex: cardex,
		audit:  audit,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) Create(ctx context.Context, header CreateHeader, actor requestctx.Actor) (TransferView, error) {
	h := normalizeHeader(header.toHeader())
	if fields := createHeaderFields(h); len(fields) > 0 {
		return TransferView{}, errormap.Validation(validationMessage, fields)
	}
	now := s.now()
	t := Transfer{
		ID:          uuid.NewString(),
		Status:      StatusDraft,
		CurrentStep: 1,
		Header:      h,
		Lines:       []Line{},
		CreatedBy: CreatedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Insert(ctx, t); err != nil {
		return TransferView{}, err
	}
	return toView(t), nil
}

func (s *Service) Get(ctx context.Context, id string) (TransferView, error) {
	t, err := s.load(ctx, id)
	if err != nil {
		return TransferView{}, err
	}
	return toView(t), nil
}

func (s *Service) List(ctx context.Context, status string, p pagination.Params) (pagination.Result[TransferView], error) {
	items, total, err := s.repo.List(ctx, status, p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[TransferView]{}, err
	}
	views := make([]TransferView, 0, len(items))
	for _, t := range items {
		views = append(views, toView(t))
	}
	return pagination.Wrap(views, int(total), p.Page, p.PageSize), nil
}

func (s *Service) Patch(ctx context.Context, id string, patch PatchBody) (TransferView, error) {
	t, err := s.loadDraft(ctx, id)
	if err != nil {
		return TransferView{}, err
	}
	applyHeaderPatch(&t, patch)
	t.Header = normalizeHeader(t.Header)
	fields := createHeaderFields(t.Header)
	if patch.CurrentStep != nil {
		step := *patch.CurrentStep
		if step < 1 || step > 2 {
			fields["currentStep"] = "مرحله نامعتبر است"
		} else {
			t.CurrentStep = step
		}
	}
	if len(fields) > 0 {
		return TransferView{}, errormap.Validation(validationMessage, fields)
	}
	t.UpdatedAt = s.now()
	if ok, err := s.replaceDraft(ctx, t); err != nil || !ok {
		return TransferView{}, err
	}
	return toView(t), nil
}

func (s *Service) AddLine(ctx context.Context, transferID string, req AddLineRequest) (TransferView, error) {
	t, err := s.loadDraft(ctx, transferID)
	if err != nil {
		return TransferView{}, err
	}
	if fields := addLineFields(req); len(fields) > 0 {
		return TransferView{}, errormap.Validation(validationMessage, fields)
	}
	batchID := strings.TrimSpace(req.SourceBatchID)
	batch, err := s.shelf.GetBatch(ctx, batchID)
	if err != nil {
		return TransferView{}, err
	}
	if batch == nil {
		return TransferView{}, errormap.NotFound("بچ موجودی یافت نشد")
	}
	if batch.Status != "active" {
		return TransferView{}, errormap.Validation(validationMessage, batchInactiveFields())
	}
	staged := stagedQtyForBatch(t.Lines, batchID, "")
	if staged+req.Quantity > batch.Quantity {
		return TransferView{}, errormap.Validation(validationMessage, map[string]string{
			"quantity": "تعداد بیش از موجودی بچ است",
		})
	}
	destBinID := strings.TrimSpace(req.DestBinID)
	destLabel := strings.TrimSpace(req.DestLocationLabel)
	if destBinID != "" {
		bin, err := s.shelf.GetBin(ctx, destBinID)
		if err != nil {
			return TransferView{}, err
		}
		if bin == nil {
			return TransferView{}, errormap.NotFound("قفسه مقصد یافت نشد")
		}
		if destLabel == "" {
			destLabel = strings.TrimSpace(bin.Address)
		}
	}
	match := strings.TrimSpace(req.MatchStatus)
	if match == "" {
		match = "barcode"
	} else if !allowedMatchStatus(match) {
		return TransferView{}, errormap.Validation(validationMessage, map[string]string{
			"matchStatus": "وضعیت تطبیق نامعتبر است",
		})
	}
	unit := strings.TrimSpace(batch.UnitLabel)
	if unit == "" {
		unit = "عدد"
	}
	srcLabel := strings.TrimSpace(batch.LocationLabel)
	t.Lines = append(t.Lines, Line{
		ID:                  uuid.NewString(),
		DrugID:              batch.DrugID,
		NameFa:              batch.NameFa,
		BatchNo:             batch.BatchNo,
		Expiry:              batch.Expiry,
		SourceBatchID:       batch.ID,
		SourceBinID:         strings.TrimSpace(batch.BinID),
		SourceLocationLabel: srcLabel,
		DestBinID:           destBinID,
		DestLocationLabel:   destLabel,
		Quantity:            req.Quantity,
		UnitLabel:           unit,
		MatchStatus:         match,
	})
	t.UpdatedAt = s.now()
	if ok, err := s.replaceDraft(ctx, t); err != nil || !ok {
		return TransferView{}, err
	}
	return toView(t), nil
}

func (s *Service) PatchLine(ctx context.Context, transferID, lineID string, patch PatchLineRequest) (TransferView, error) {
	t, err := s.loadDraft(ctx, transferID)
	if err != nil {
		return TransferView{}, err
	}
	idx := lineIndex(t.Lines, lineID)
	if idx < 0 {
		return TransferView{}, errormap.NotFound("قلم انتقال یافت نشد")
	}
	line := t.Lines[idx]
	if patch.Quantity != nil {
		qty := *patch.Quantity
		if qty <= 0 {
			return TransferView{}, errormap.Validation(validationMessage, map[string]string{
				"quantity": "تعداد باید بزرگ‌تر از صفر باشد",
			})
		}
		batch, err := s.shelf.GetBatch(ctx, line.SourceBatchID)
		if err != nil {
			return TransferView{}, err
		}
		if batch == nil {
			return TransferView{}, errormap.NotFound("بچ موجودی یافت نشد")
		}
		if batch.Status != "active" {
			return TransferView{}, errormap.Validation(validationMessage, batchInactiveFields())
		}
		otherStaged := stagedQtyForBatch(t.Lines, line.SourceBatchID, lineID)
		if otherStaged+qty > batch.Quantity {
			return TransferView{}, errormap.Validation(validationMessage, map[string]string{
				"quantity": "تعداد بیش از موجودی بچ است",
			})
		}
		line.Quantity = qty
	}
	if patch.MatchStatus != nil {
		match := strings.TrimSpace(*patch.MatchStatus)
		if !allowedMatchStatus(match) {
			return TransferView{}, errormap.Validation(validationMessage, map[string]string{
				"matchStatus": "وضعیت تطبیق نامعتبر است",
			})
		}
		line.MatchStatus = match
	}
	destLabel := line.DestLocationLabel
	destBinID := line.DestBinID
	if patch.DestLocationLabel != nil {
		destLabel = strings.TrimSpace(*patch.DestLocationLabel)
	}
	if patch.DestBinID != nil {
		nextBinID := strings.TrimSpace(*patch.DestBinID)
		binChanged := nextBinID != line.DestBinID
		destBinID = nextBinID
		if destBinID != "" {
			bin, err := s.shelf.GetBin(ctx, destBinID)
			if err != nil {
				return TransferView{}, err
			}
			if bin == nil {
				return TransferView{}, errormap.NotFound("قفسه مقصد یافت نشد")
			}
			if patch.DestLocationLabel == nil && (binChanged || strings.TrimSpace(destLabel) == "") {
				destLabel = strings.TrimSpace(bin.Address)
			}
		} else if patch.DestLocationLabel == nil && binChanged {
			destLabel = ""
		}
	}
	line.DestBinID = destBinID
	line.DestLocationLabel = destLabel
	t.Lines[idx] = line
	t.UpdatedAt = s.now()
	if ok, err := s.replaceDraft(ctx, t); err != nil || !ok {
		return TransferView{}, err
	}
	return toView(t), nil
}

type confirmUndo struct {
	fullMove     bool
	sourceID     string
	oldLocation  string
	oldBinID     string
	oldZone      string
	oldQty       int
	newBatchID   string
	destLocation string
	destBinID    string
	destZone     string
}

func (s *Service) Confirm(ctx context.Context, id string, actor requestctx.Actor, ip string) (TransferView, error) {
	t, err := s.load(ctx, id)
	if err != nil {
		return TransferView{}, err
	}
	if t.Status != StatusDraft {
		return TransferView{}, errormap.Conflict("فقط پیش‌نویس قابل تایید است")
	}
	if len(t.Lines) == 0 {
		return TransferView{}, errormap.Validation(validationMessage, map[string]string{
			"lines": "حداقل یک قلم الزامی است",
		})
	}
	if fields := confirmDestFields(t.Lines); len(fields) > 0 {
		return TransferView{}, errormap.Validation(validationMessage, fields)
	}

	claimed, err := s.repo.ClaimForConfirm(ctx, id)
	if err != nil {
		return TransferView{}, err
	}
	if !claimed {
		return TransferView{}, errormap.Conflict("فقط پیش‌نویس قابل تایید است")
	}
	t.Status = StatusConfirming

	initialQty, fields, err := s.validateConfirmLines(ctx, t.Lines)
	if err != nil {
		s.revertConfirmDraft(ctx, id)
		return TransferView{}, err
	}
	if len(fields) > 0 {
		s.revertConfirmDraft(ctx, id)
		return TransferView{}, errormap.Validation(validationMessage, fields)
	}

	var undos []confirmUndo
	var movementIDs []string
	resultIDs := make([]string, 0, len(t.Lines))
	controlled := false
	consumed := make(map[string]int)

	abort := func(err error) (TransferView, error) {
		s.rollbackConfirm(ctx, undos, movementIDs)
		s.revertConfirmDraft(ctx, id)
		return TransferView{}, err
	}

	for _, line := range t.Lines {
		batch, err := s.shelf.GetBatch(ctx, line.SourceBatchID)
		if err != nil {
			return abort(err)
		}
		if batch == nil {
			return abort(errormap.NotFound("بچ موجودی یافت نشد"))
		}
		if batch.Status != "active" {
			return abort(errormap.Validation(validationMessage, batchInactiveFields()))
		}
		available := initialQty[line.SourceBatchID] - consumed[line.SourceBatchID]
		if line.Quantity > available {
			return abort(errormap.Validation(validationMessage, map[string]string{
				"quantity": "تعداد بیش از موجودی بچ است",
			}))
		}
		destLabel, destBinID, destZone, err := s.resolveDest(ctx, line)
		if err != nil {
			return abort(err)
		}
		srcLabel := strings.TrimSpace(line.SourceLocationLabel)
		if srcLabel == "" {
			srcLabel = strings.TrimSpace(batch.LocationLabel)
		}

		u := confirmUndo{
			sourceID:     batch.ID,
			oldLocation:  batch.LocationLabel,
			oldBinID:     batch.BinID,
			oldZone:      batch.Zone,
			oldQty:       batch.Quantity,
			destLocation: destLabel,
			destBinID:    destBinID,
			destZone:     destZone,
		}

		var resultID string
		if line.Quantity == batch.Quantity {
			u.fullMove = true
			if destBinID != "" {
				if err := s.shelf.UpdateBatchLocation(ctx, batch.ID, destLabel, destBinID, destZone); err != nil {
					return abort(err)
				}
			} else {
				moved := *batch
				moved.LocationLabel = destLabel
				moved.BinID = ""
				moved.Zone = ""
				if err := s.shelf.UpdateBatch(ctx, moved); err != nil {
					return abort(err)
				}
			}
			undos = append(undos, u)
			resultID = batch.ID
		} else {
			reduced := *batch
			reduced.Quantity = batch.Quantity - line.Quantity
			if err := s.shelf.UpdateBatch(ctx, reduced); err != nil {
				return abort(err)
			}
			u.fullMove = false
			undos = append(undos, u)
			clone := cloneBatchAtDest(*batch, line.Quantity, destLabel, destBinID, destZone)
			if err := s.shelf.InsertBatch(ctx, clone); err != nil {
				return abort(err)
			}
			undos[len(undos)-1].newBatchID = clone.ID
			resultID = clone.ID
		}
		consumed[line.SourceBatchID] += line.Quantity
		resultIDs = append(resultIDs, resultID)
		if batch.IsControlled {
			controlled = true
		}

		if s.cardex != nil {
			mv, err := s.cardex.Append(ctx, cardex.AppendInput{
				DrugID: line.DrugID, Type: "transfer", BatchNo: line.BatchNo,
				QtyOut: line.Quantity, QtyIn: line.Quantity,
				ActorName: actor.Name, ShiftLabel: "صبح",
				Note:      "انتقال داخلی از " + srcLabel + " به " + destLabel,
				At:        s.now(),
			})
			if err != nil {
				return abort(err)
			}
			movementIDs = append(movementIDs, mv.ID)
		}
	}

	now := s.now()
	no := transferNoAt(now)
	if s.audit != nil {
		_, err = s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      "transfer",
			EntityType:  "transfer",
			EntityID:    t.ID,
			EntityLabel: t.Header.SourceLabel + " → " + t.Header.DestLabel,
			Description: fmt.Sprintf("تایید انتقال داخلی (%s) — %d قلم", reasonLabel(t.Header.Reason), len(t.Lines)),
			After: map[string]any{
				"transferNo":     no,
				"resultBatchIds": resultIDs,
				"lineCount":      len(t.Lines),
				"reason":         t.Header.Reason,
			},
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: controlled,
		})
		if err != nil {
			return abort(err)
		}
	}

	t.Status = StatusConfirmed
	t.TransferNo = no
	t.ResultBatchIDs = resultIDs
	t.ConfirmedAt = &now
	t.UpdatedAt = now
	if err := s.repo.Replace(ctx, t); err != nil {
		return abort(err)
	}
	return toView(t), nil
}

func (s *Service) resolveDest(ctx context.Context, line Line) (location, binID, zone string, err error) {
	location = strings.TrimSpace(line.DestLocationLabel)
	binID = strings.TrimSpace(line.DestBinID)
	if binID != "" {
		bin, err := s.shelf.GetBin(ctx, binID)
		if err != nil {
			return "", "", "", err
		}
		if bin == nil {
			return "", "", "", errormap.NotFound("قفسه مقصد یافت نشد")
		}
		zone = bin.Zone
		if location == "" {
			location = strings.TrimSpace(bin.Address)
		}
	}
	return location, binID, zone, nil
}

func cloneBatchAtDest(src shelf.StockBatch, qty int, location, binID, zone string) shelf.StockBatch {
	clone := src
	clone.ID = uuid.NewString()
	clone.Quantity = qty
	clone.LocationLabel = location
	clone.BinID = binID
	clone.Zone = zone
	return clone
}

func (s *Service) rollbackConfirm(ctx context.Context, undos []confirmUndo, movementIDs []string) {
	for i := len(undos) - 1; i >= 0; i-- {
		u := undos[i]
		if u.fullMove {
			if u.destBinID != "" {
				_ = s.shelf.UpdateBatchLocation(ctx, u.sourceID, u.oldLocation, u.oldBinID, u.oldZone)
			} else {
				batch, _ := s.shelf.GetBatch(ctx, u.sourceID)
				if batch != nil {
					restored := *batch
					restored.LocationLabel = u.oldLocation
					restored.BinID = u.oldBinID
					restored.Zone = u.oldZone
					_ = s.shelf.UpdateBatch(ctx, restored)
				}
			}
		} else {
			batch, _ := s.shelf.GetBatch(ctx, u.sourceID)
			if batch != nil {
				restored := *batch
				restored.Quantity = u.oldQty
				_ = s.shelf.UpdateBatch(ctx, restored)
			}
			if u.newBatchID != "" {
				_ = s.shelf.DeleteBatch(ctx, u.newBatchID)
			}
		}
	}
	if s.cardex != nil {
		for _, id := range movementIDs {
			_ = s.cardex.Delete(ctx, id)
		}
	}
}

func confirmDestFields(lines []Line) map[string]string {
	fields := map[string]string{}
	for i, line := range lines {
		if strings.TrimSpace(line.DestLocationLabel) == "" && strings.TrimSpace(line.DestBinID) == "" {
			fields[fmt.Sprintf("lines[%d].destLocationLabel", i)] = "مقصد قلم الزامی است"
		}
	}
	return fields
}

func transferNoAt(now time.Time) string {
	h := strings.ReplaceAll(uuid.NewString(), "-", "")[:6]
	return fmt.Sprintf("TRF-%s-%s", now.Format("20060102"), h)
}

func (s *Service) DeleteLine(ctx context.Context, transferID, lineID string) (TransferView, error) {
	t, err := s.loadDraft(ctx, transferID)
	if err != nil {
		return TransferView{}, err
	}
	idx := lineIndex(t.Lines, lineID)
	if idx < 0 {
		return TransferView{}, errormap.NotFound("قلم انتقال یافت نشد")
	}
	t.Lines = append(t.Lines[:idx], t.Lines[idx+1:]...)
	t.UpdatedAt = s.now()
	if ok, err := s.replaceDraft(ctx, t); err != nil || !ok {
		return TransferView{}, err
	}
	return toView(t), nil
}

func (s *Service) ClearLines(ctx context.Context, transferID string) (TransferView, error) {
	t, err := s.loadDraft(ctx, transferID)
	if err != nil {
		return TransferView{}, err
	}
	t.Lines = []Line{}
	t.UpdatedAt = s.now()
	if ok, err := s.replaceDraft(ctx, t); err != nil || !ok {
		return TransferView{}, err
	}
	return toView(t), nil
}

func (s *Service) replaceDraft(ctx context.Context, t Transfer) (bool, error) {
	ok, err := s.repo.ReplaceIfDraft(ctx, t)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, errormap.Conflict("فقط پیش‌نویس قابل ویرایش است")
	}
	return true, nil
}

func (s *Service) revertConfirmDraft(ctx context.Context, id string) {
	_ = s.repo.RevertToDraft(ctx, id)
}

func batchInactiveFields() map[string]string {
	return map[string]string{"sourceBatchId": "بچ منبع فعال نیست"}
}

func sumLinesBySourceBatch(lines []Line) map[string]int {
	sums := make(map[string]int)
	for _, line := range lines {
		sums[line.SourceBatchID] += line.Quantity
	}
	return sums
}

func stagedQtyForBatch(lines []Line, batchID, excludeLineID string) int {
	total := 0
	for _, line := range lines {
		if line.SourceBatchID == batchID && (excludeLineID == "" || line.ID != excludeLineID) {
			total += line.Quantity
		}
	}
	return total
}

func reasonLabel(code string) string {
	switch code {
	case "routine_front":
		return "شارژ روتین پیشخوان نسخه‌پیچی"
	case "urgent_rx":
		return "کسری نسخه فوری و بیمار در انتظار"
	case "night_cap":
		return "تکمیل سقف موجودی شیفت شب"
	case "fefo_move":
		return "جابجایی بر اساس تاریخ انقضای نزدیک (FEFO)"
	default:
		return code
	}
}

func (s *Service) validateConfirmLines(ctx context.Context, lines []Line) (map[string]int, map[string]string, error) {
	sums := sumLinesBySourceBatch(lines)
	fields := map[string]string{}
	initialQty := make(map[string]int)
	for batchID, sumQty := range sums {
		batch, err := s.shelf.GetBatch(ctx, batchID)
		if err != nil {
			return nil, nil, err
		}
		if batch == nil {
			return nil, nil, errormap.NotFound("بچ موجودی یافت نشد")
		}
		if batch.Status != "active" {
			return nil, batchInactiveFields(), nil
		}
		initialQty[batchID] = batch.Quantity
		if sumQty > batch.Quantity {
			fields["quantity"] = "تعداد بیش از موجودی بچ است"
			return initialQty, fields, nil
		}
	}
	return initialQty, fields, nil
}

func (s *Service) load(ctx context.Context, id string) (Transfer, error) {
	t, err := s.repo.Get(ctx, id)
	if err != nil {
		return Transfer{}, err
	}
	if t == nil {
		return Transfer{}, errormap.NotFound("انتقال یافت نشد")
	}
	if t.Lines == nil {
		t.Lines = []Line{}
	}
	return *t, nil
}

func (s *Service) loadDraft(ctx context.Context, id string) (Transfer, error) {
	t, err := s.load(ctx, id)
	if err != nil {
		return Transfer{}, err
	}
	if t.Status != StatusDraft {
		return Transfer{}, errormap.Conflict("فقط پیش‌نویس قابل ویرایش است")
	}
	return t, nil
}

func toView(t Transfer) TransferView {
	if t.Lines == nil {
		t.Lines = []Line{}
	}
	v := TransferView{
		ID:             t.ID,
		Status:         t.Status,
		CurrentStep:    t.CurrentStep,
		Header:         t.Header,
		Lines:          t.Lines,
		TransferNo:     t.TransferNo,
		ResultBatchIDs: t.ResultBatchIDs,
		CreatedBy:      t.CreatedBy,
		CreatedAt:      t.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:      t.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if t.ConfirmedAt != nil {
		v.ConfirmedAt = t.ConfirmedAt.UTC().Format(time.RFC3339)
	}
	return v
}

func normalizeHeader(h Header) Header {
	h.Reason = strings.TrimSpace(h.Reason)
	h.SourceZone = strings.TrimSpace(h.SourceZone)
	h.DestZone = strings.TrimSpace(h.DestZone)
	h.SourceLabel = strings.TrimSpace(h.SourceLabel)
	h.DestLabel = strings.TrimSpace(h.DestLabel)
	h.Note = strings.TrimSpace(h.Note)
	h.ReceiverName = strings.TrimSpace(h.ReceiverName)
	return h
}

func createHeaderFields(h Header) map[string]string {
	fields := map[string]string{}
	if h.SourceLabel == "" {
		fields["sourceLabel"] = "مبدأ انتقال الزامی است"
	}
	if !allowedReason(h.Reason) {
		fields["reason"] = "دلیل انتقال نامعتبر است"
	}
	return fields
}

func addLineFields(req AddLineRequest) map[string]string {
	fields := map[string]string{}
	if strings.TrimSpace(req.SourceBatchID) == "" {
		fields["sourceBatchId"] = "شناسه بچ مبدأ الزامی است"
	}
	if req.Quantity <= 0 {
		fields["quantity"] = "تعداد باید بزرگ‌تر از صفر باشد"
	}
	if m := strings.TrimSpace(req.MatchStatus); m != "" && !allowedMatchStatus(m) {
		fields["matchStatus"] = "وضعیت تطبیق نامعتبر است"
	}
	return fields
}

func allowedReason(v string) bool {
	switch v {
	case "routine_front", "urgent_rx", "night_cap", "fefo_move":
		return true
	default:
		return false
	}
}

func allowedMatchStatus(v string) bool {
	switch v {
	case "barcode", "physical":
		return true
	default:
		return false
	}
}

func applyHeaderPatch(t *Transfer, patch PatchBody) {
	if patch.Reason != nil {
		t.Header.Reason = *patch.Reason
	}
	if patch.SourceZone != nil {
		t.Header.SourceZone = *patch.SourceZone
	}
	if patch.DestZone != nil {
		t.Header.DestZone = *patch.DestZone
	}
	if patch.SourceLabel != nil {
		t.Header.SourceLabel = *patch.SourceLabel
	}
	if patch.DestLabel != nil {
		t.Header.DestLabel = *patch.DestLabel
	}
	if patch.Note != nil {
		t.Header.Note = *patch.Note
	}
	if patch.ReceiverName != nil {
		t.Header.ReceiverName = *patch.ReceiverName
	}
}

func lineIndex(lines []Line, id string) int {
	for i, line := range lines {
		if line.ID == id {
			return i
		}
	}
	return -1
}
