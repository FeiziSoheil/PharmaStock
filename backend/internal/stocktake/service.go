package stocktake

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

const validationMessage = "لطفاً فیلدهای الزامی را تکمیل کنید"

type cycleStore interface {
	Insert(ctx context.Context, c Cycle) error
	Get(ctx context.Context, id string) (*Cycle, error)
	List(ctx context.Context, status string, page, pageSize int) ([]Cycle, int64, error)
	Replace(ctx context.Context, c Cycle) error
	ReplaceIfActive(ctx context.Context, c Cycle) (bool, error)
	ClaimForConfirm(ctx context.Context, id string) (bool, error)
	RevertToActive(ctx context.Context, id string) error
}

type shelfStore interface {
	AllBatches(ctx context.Context) ([]shelf.StockBatch, error)
	GetBatch(ctx context.Context, id string) (*shelf.StockBatch, error)
	BatchesByDrug(ctx context.Context, drugID string) ([]shelf.StockBatch, error)
	SetBatchQuantityAndStatus(ctx context.Context, id string, quantity int, status string) error
}

type drugStore interface {
	All(ctx context.Context) ([]drug.Drug, error)
	UpdateTotalStock(ctx context.Context, id string, totalStock int) error
}

type cardexWriter interface {
	Append(ctx context.Context, in cardex.AppendInput) (cardex.Movement, error)
	Delete(ctx context.Context, id string) error
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

var (
	_ cycleStore   = (*Repository)(nil)
	_ shelfStore   = (*shelf.Repository)(nil)
	_ drugStore    = (*drug.Repository)(nil)
	_ cardexWriter = (*cardex.Service)(nil)
	_ auditWriter  = (*audit.Service)(nil)
)

type Service struct {
	repo   cycleStore
	shelf  shelfStore
	drugs  drugStore
	cardex cardexWriter
	audit  auditWriter
	now    func() time.Time
}

func NewService(repo cycleStore, shelf shelfStore, drugs drugStore, cardex cardexWriter, audit auditWriter) *Service {
	return &Service{
		repo:   repo,
		shelf:  shelf,
		drugs:  drugs,
		cardex: cardex,
		audit:  audit,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

func normalizeZone(raw string) (code string, label string, ok bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "all":
		return "all", "همه بخش‌ها و قفسه‌های انبار", true
	case "a", "zone-a", "main":
		return "A", "سالن اصلی انبار دارو (زون A)", true
	case "c", "zone-b", "zone-c", "dispensing":
		return "C", "قفسه‌های پیشخوان تحویل نسخه (زون C)", true
	case "r", "zone-cold", "cold":
		return "R", "اتاق سرد و زنجیره سرد بیولوژیک (زون R)", true
	case "s", "zone-narcotic", "controlled":
		return "S", "انبار اقلام تحت کنترل و مخدر (زون S)", true
	default:
		return "", "", false
	}
}

func normalizeMethod(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", MethodBlind:
		return MethodBlind, true
	case MethodOpen:
		return MethodOpen, true
	default:
		return "", false
	}
}

func (s *Service) Create(ctx context.Context, req CreateCycleRequest, actor requestctx.Actor) (CycleView, error) {
	zoneCode, zoneLabel, okZone := normalizeZone(req.Zone)
	if !okZone {
		return CycleView{}, errormap.Validation(validationMessage, map[string]string{
			"zone": "بخش / زون انتخاب‌شده نامعتبر است",
		})
	}
	method, okMethod := normalizeMethod(req.Method)
	if !okMethod {
		return CycleView{}, errormap.Validation(validationMessage, map[string]string{
			"method": "روش شمارش نامعتبر است",
		})
	}

	batches, err := s.shelf.AllBatches(ctx)
	if err != nil {
		return CycleView{}, err
	}
	drugsList, err := s.drugs.All(ctx)
	if err != nil {
		return CycleView{}, err
	}
	drugByID := make(map[string]drug.Drug, len(drugsList))
	for _, d := range drugsList {
		drugByID[d.ID] = d
	}

	items := make([]CycleItem, 0)
	for _, b := range batches {
		if b.Status == "depleted" && b.Quantity <= 0 {
			continue
		}
		if zoneCode != "all" && !strings.EqualFold(strings.TrimSpace(b.Zone), zoneCode) {
			continue
		}
		d, hasDrug := drugByID[b.DrugID]
		unitPrice := int64(b.BuyPriceRial)
		if unitPrice <= 0 {
			unitPrice = int64(b.ConsumerPriceRial)
		}
		if unitPrice <= 0 && hasDrug && d.UnitCost > 0 {
			unitPrice = int64(d.UnitCost)
		}
		unitLabel := strings.TrimSpace(b.UnitLabel)
		if unitLabel == "" && hasDrug {
			unitLabel = strings.TrimSpace(d.UnitLabel)
		}
		if unitLabel == "" {
			unitLabel = "عدد"
		}
		nameEn := strings.TrimSpace(b.NameEn)
		if nameEn == "" && hasDrug {
			nameEn = strings.TrimSpace(d.BrandName)
			if d.Strength != "" {
				nameEn = strings.TrimSpace(nameEn + " " + d.Strength)
			}
		}
		manufacturer := strings.TrimSpace(b.Manufacturer)
		if manufacturer == "" && hasDrug {
			manufacturer = strings.TrimSpace(d.Manufacturer)
		}
		items = append(items, CycleItem{
			ID:            uuid.NewString(),
			BatchID:       b.ID,
			DrugID:        b.DrugID,
			NameFa:        b.NameFa,
			NameEn:        nameEn,
			GTIN:          d.GTIN,
			GenericCode:   d.GenericCode,
			Manufacturer:  manufacturer,
			BatchNo:       b.BatchNo,
			Expiry:        b.Expiry,
			Zone:          b.Zone,
			BinID:         b.BinID,
			LocationLabel: b.LocationLabel,
			UnitLabel:     unitLabel,
			IsControlled:  b.IsControlled || (hasDrug && d.IsControlled),
			UnitPriceRial: unitPrice,
			SystemQty:     b.Quantity,
			CountStatus:   ItemStatusPending,
		})
	}

	if len(items) == 0 {
		return CycleView{}, errormap.Validation("هیچ بچ فعالی در بخش انتخاب‌شده یافت نشد", map[string]string{
			"zone": "هیچ بچ فعالی در بخش انتخاب‌شده یافت نشد",
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Zone != items[j].Zone {
			return items[i].Zone < items[j].Zone
		}
		if items[i].LocationLabel != items[j].LocationLabel {
			return items[i].LocationLabel < items[j].LocationLabel
		}
		if items[i].NameFa != items[j].NameFa {
			return items[i].NameFa < items[j].NameFa
		}
		return items[i].BatchNo < items[j].BatchNo
	})

	counterName := strings.TrimSpace(req.CounterName)
	if counterName == "" {
		counterName = strings.TrimSpace(actor.Name)
	}
	if counterName == "" {
		counterName = "اپراتور انبار"
	}
	supervisorName := strings.TrimSpace(req.SupervisorName)
	if supervisorName == "" {
		supervisorName = "دکتر رضایی"
	}

	now := s.now()
	c := Cycle{
		ID:             uuid.NewString(),
		CycleCode:      cycleCodeAt(now),
		Status:         StatusActive,
		Zone:           zoneCode,
		ZoneLabel:      zoneLabel,
		Method:         method,
		CounterName:    counterName,
		SupervisorName: supervisorName,
		Note:           strings.TrimSpace(req.Note),
		Items:          items,
		CreatedBy: CreatedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Insert(ctx, c); err != nil {
		return CycleView{}, err
	}
	return toView(c), nil
}

func (s *Service) Get(ctx context.Context, id string) (CycleView, error) {
	c, err := s.load(ctx, id)
	if err != nil {
		return CycleView{}, err
	}
	return toView(c), nil
}

func (s *Service) List(ctx context.Context, status string, p pagination.Params) (pagination.Result[CycleListItem], error) {
	items, total, err := s.repo.List(ctx, strings.TrimSpace(status), p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[CycleListItem]{}, err
	}
	out := make([]CycleListItem, 0, len(items))
	for _, c := range items {
		out = append(out, toListItem(c))
	}
	return pagination.Wrap(out, int(total), p.Page, p.PageSize), nil
}

func (s *Service) UpdateSettings(ctx context.Context, id string, req UpdateSettingsRequest) (CycleView, error) {
	c, err := s.loadActive(ctx, id)
	if err != nil {
		return CycleView{}, err
	}
	if req.Method != nil {
		method, ok := normalizeMethod(*req.Method)
		if !ok {
			return CycleView{}, errormap.Validation(validationMessage, map[string]string{
				"method": "روش شمارش نامعتبر است",
			})
		}
		c.Method = method
	}
	if req.CounterName != nil {
		v := strings.TrimSpace(*req.CounterName)
		if v == "" {
			return CycleView{}, errormap.Validation(validationMessage, map[string]string{
				"counterName": "نام شمارش‌گر الزامی است",
			})
		}
		c.CounterName = v
	}
	if req.SupervisorName != nil {
		v := strings.TrimSpace(*req.SupervisorName)
		if v == "" {
			return CycleView{}, errormap.Validation(validationMessage, map[string]string{
				"supervisorName": "نام ناظر فنی الزامی است",
			})
		}
		c.SupervisorName = v
	}
	if req.Note != nil {
		c.Note = strings.TrimSpace(*req.Note)
	}
	c.UpdatedAt = s.now()
	if err := s.replaceActive(ctx, c); err != nil {
		return CycleView{}, err
	}
	return toView(c), nil
}

func (s *Service) RecordItem(ctx context.Context, cycleID, itemID string, req RecordItemRequest, actor requestctx.Actor) (CycleView, error) {
	c, err := s.loadActive(ctx, cycleID)
	if err != nil {
		return CycleView{}, err
	}
	idx := findItemIndex(c.Items, itemID)
	if idx < 0 {
		return CycleView{}, errormap.NotFound("ردیف انبارگردانی یافت نشد")
	}

	item := c.Items[idx]
	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action == "" {
		action = "count"
	}

	now := s.now()
	switch action {
	case "count":
		if req.PhysicalQty == nil || *req.PhysicalQty < 0 {
			return CycleView{}, errormap.Validation(validationMessage, map[string]string{
				"physicalQty": "تعداد شمارش فیزیکی باید صفر یا بزرگ‌تر باشد",
			})
		}
		qty := *req.PhysicalQty
		item.PhysicalQty = &qty
		item.CountStatus = ItemStatusCounted
		item.CountedAt = &now
		if actor.Name != "" {
			item.CountedBy = actor.Name
		} else {
			item.CountedBy = c.CounterName
		}
		if req.VarianceReason != nil {
			item.VarianceReason = strings.TrimSpace(*req.VarianceReason)
		} else if item.VarianceReason == "" && qty == item.SystemQty {
			item.VarianceReason = "شمارش مطابق کاردکس"
		}
		if req.SupervisorVerified != nil {
			item.SupervisorVerified = *req.SupervisorVerified
		} else {
			// Reset supervisor verification if quantity changed after prior verification.
			item.SupervisorVerified = false
		}
	case "skip":
		item.CountStatus = ItemStatusSkipped
		item.PhysicalQty = nil
		item.SupervisorVerified = false
		if req.VarianceReason != nil {
			item.VarianceReason = strings.TrimSpace(*req.VarianceReason)
		}
	case "recount":
		item.CountStatus = ItemStatusPending
		item.PhysicalQty = nil
		item.SupervisorVerified = false
		item.CountedAt = nil
		item.CountedBy = ""
	case "verify":
		if item.CountStatus != ItemStatusCounted || item.PhysicalQty == nil {
			return CycleView{}, errormap.Validation(validationMessage, map[string]string{
				"physicalQty": "ابتدا شمارش فیزیکی این قلم را ثبت کنید",
			})
		}
		verified := true
		if req.SupervisorVerified != nil {
			verified = *req.SupervisorVerified
		}
		item.SupervisorVerified = verified
		if req.VarianceReason != nil {
			item.VarianceReason = strings.TrimSpace(*req.VarianceReason)
		}
	case "note":
		if req.VarianceReason != nil {
			item.VarianceReason = strings.TrimSpace(*req.VarianceReason)
		}
		if req.SupervisorVerified != nil {
			item.SupervisorVerified = *req.SupervisorVerified
		}
	default:
		return CycleView{}, errormap.Validation(validationMessage, map[string]string{
			"action": "عملیات درخواستی نامعتبر است",
		})
	}

	c.Items[idx] = item
	c.UpdatedAt = now
	if err := s.replaceActive(ctx, c); err != nil {
		return CycleView{}, err
	}
	return toView(c), nil
}

type batchUndo struct {
	batchID   string
	oldQty    int
	oldStatus string
}

type drugStockUndo struct {
	drugID     string
	totalStock int
}

func (s *Service) Confirm(ctx context.Context, id string, req ConfirmCycleRequest, actor requestctx.Actor, ip string) (CycleView, error) {
	c, err := s.load(ctx, id)
	if err != nil {
		return CycleView{}, err
	}
	if c.Status != StatusActive {
		return CycleView{}, errormap.Conflict("فقط دوره فعال قابل تایید نهایی است")
	}

	summary := computeSummary(c.Items)
	if summary.CountedItems == 0 {
		return CycleView{}, errormap.Validation(validationMessage, map[string]string{
			"items": "حداقل یک قلم باید شمارش شده باشد",
		})
	}

	supervisor := strings.TrimSpace(req.SupervisorName)
	if supervisor == "" {
		supervisor = strings.TrimSpace(c.SupervisorName)
	}
	if supervisor == "" {
		return CycleView{}, errormap.Validation(validationMessage, map[string]string{
			"supervisorName": "نام ناظر فنی برای صدور سند تعدیل الزامی است",
		})
	}

	// Check high-variance items (> 500,000 Rial)
	unverifiedHigh := 0
	for _, it := range c.Items {
		if it.CountStatus != ItemStatusCounted || it.PhysicalQty == nil {
			continue
		}
		diff := *it.PhysicalQty - it.SystemQty
		absVal := int64(diff) * it.UnitPriceRial
		if absVal < 0 {
			absVal = -absVal
		}
		if absVal > HighVarianceThresholdRial && !it.SupervisorVerified {
			unverifiedHigh++
		}
	}
	if unverifiedHigh > 0 && !req.SupervisorConfirm {
		return CycleView{}, errormap.Validation(
			"اقلام دارای مغایرت بالای ۵۰۰,۰۰۰ ریال نیازمند تایید ناظر فنی هستند",
			map[string]string{"supervisorConfirm": "تایید ناظر برای مغایرت‌های بحرانی الزامی است"},
		)
	}

	claimed, err := s.repo.ClaimForConfirm(ctx, id)
	if err != nil {
		return CycleView{}, err
	}
	if !claimed {
		return CycleView{}, errormap.Conflict("فقط دوره فعال قابل تایید نهایی است")
	}
	c.Status = StatusConfirming
	c.SupervisorName = supervisor
	if strings.TrimSpace(req.Note) != "" {
		c.Note = strings.TrimSpace(req.Note)
	}

	now := s.now()
	docNo := adjustmentDocNoAt(now)
	var batchUndos []batchUndo
	var movementIDs []string
	var drugUndos []drugStockUndo
	affectedDrugs := make(map[string]struct{})
	controlled := false
	adjustedCount := 0

	abort := func(err error) (CycleView, error) {
		s.rollbackConfirm(ctx, batchUndos, movementIDs, drugUndos)
		_ = s.repo.RevertToActive(ctx, id)
		return CycleView{}, err
	}

	// Snapshot prior drug totals once for rollback safety.
	drugsList, err := s.drugs.All(ctx)
	if err != nil {
		return abort(err)
	}
	drugStockMap := make(map[string]int, len(drugsList))
	for _, d := range drugsList {
		drugStockMap[d.ID] = d.TotalStock
	}

	for i, it := range c.Items {
		if it.CountStatus != ItemStatusCounted || it.PhysicalQty == nil {
			continue
		}
		absVal := int64(*it.PhysicalQty-it.SystemQty) * it.UnitPriceRial
		if absVal < 0 {
			absVal = -absVal
		}
		if req.SupervisorConfirm && absVal > HighVarianceThresholdRial && !it.SupervisorVerified {
			c.Items[i].SupervisorVerified = true
		}

		diff := *it.PhysicalQty - it.SystemQty
		if diff == 0 {
			continue
		}

		batch, err := s.shelf.GetBatch(ctx, it.BatchID)
		if err != nil {
			return abort(err)
		}
		if batch == nil {
			return abort(errormap.NotFound("بچ موجودی یافت نشد"))
		}

		newQty := *it.PhysicalQty
		nextStatus := batch.Status
		if newQty <= 0 {
			nextStatus = "depleted"
		} else if batch.Status == "depleted" || batch.Status == "" {
			nextStatus = "active"
		}

		if err := s.shelf.SetBatchQuantityAndStatus(ctx, batch.ID, newQty, nextStatus); err != nil {
			return abort(err)
		}
		batchUndos = append(batchUndos, batchUndo{
			batchID:   batch.ID,
			oldQty:    batch.Quantity,
			oldStatus: batch.Status,
		})
		affectedDrugs[it.DrugID] = struct{}{}
		adjustedCount++
		if it.IsControlled || batch.IsControlled {
			controlled = true
		}

		if s.cardex != nil {
			qtyIn, qtyOut := 0, 0
			if diff > 0 {
				qtyIn = diff
			} else {
				qtyOut = -diff
			}
			note := fmt.Sprintf("تعدیل انبارگردانی دوره %s (%s)", c.CycleCode, docNo)
			if strings.TrimSpace(it.VarianceReason) != "" {
				note += " — " + strings.TrimSpace(it.VarianceReason)
			}
			mv, err := s.cardex.Append(ctx, cardex.AppendInput{
				DrugID:     it.DrugID,
				Type:       "adjustment",
				BatchNo:    it.BatchNo,
				QtyIn:      qtyIn,
				QtyOut:     qtyOut,
				ActorName:  supervisor,
				ShiftLabel: "انبارگردانی",
				Note:       note,
				At:         now,
			})
			if err != nil {
				return abort(err)
			}
			movementIDs = append(movementIDs, mv.ID)
		}
	}

	// Sync drugs.totalStock for all affected drugs so catalog and dashboard stay accurate.
	for drugID := range affectedDrugs {
		batches, err := s.shelf.BatchesByDrug(ctx, drugID)
		if err != nil {
			return abort(err)
		}
		total := 0
		for _, b := range batches {
			if b.Status == "quarantined" {
				continue
			}
			if b.Quantity > 0 {
				total += b.Quantity
			}
		}
		if prev, ok := drugStockMap[drugID]; ok {
			drugUndos = append(drugUndos, drugStockUndo{drugID: drugID, totalStock: prev})
		}
		if err := s.drugs.UpdateTotalStock(ctx, drugID, total); err != nil {
			return abort(err)
		}
	}

	if s.audit != nil {
		severity := "info"
		if summary.HighVarianceCount > 0 || summary.ShortageItemsCount > 0 {
			severity = "critical"
		} else if summary.SurplusItemsCount > 0 {
			severity = "warning"
		}
		_, err = s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      "stocktake_adjust",
			EntityType:  "stocktake",
			EntityID:    c.ID,
			EntityLabel: c.CycleCode,
			Description: fmt.Sprintf(
				"تایید نهایی انبارگردانی %s و صدور سند تعدیل %s (%d قلم تعدیل‌شده)",
				c.CycleCode, docNo, adjustedCount,
			),
			Severity: severity,
			Before: map[string]any{
				"status": StatusActive,
			},
			After: map[string]any{
				"status":          StatusConfirmed,
				"cycleCode":       c.CycleCode,
				"adjustmentDocNo": docNo,
				"zone":            c.ZoneLabel,
				"shortageUnits":   summary.ShortageUnits,
				"surplusUnits":    summary.SurplusUnits,
				"netVarianceRial": summary.NetVarianceRial,
				"adjustedItems":   adjustedCount,
			},
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: controlled,
		})
		if err != nil {
			return abort(err)
		}
	}

	c.Status = StatusConfirmed
	c.AdjustmentDocNo = docNo
	c.ConfirmedAt = &now
	c.UpdatedAt = now
	if err := s.repo.Replace(ctx, c); err != nil {
		return abort(err)
	}
	return toView(c), nil
}

func (s *Service) ExportCSV(ctx context.Context, id string) ([]byte, string, error) {
	view, err := s.Get(ctx, id)
	if err != nil {
		return nil, "", err
	}
	var buf bytes.Buffer
	// UTF-8 BOM for Persian Excel compatibility
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{
		"ردیف",
		"کد دوره",
		"نام دارو",
		"کد ژنریک",
		"GTIN",
		"سری ساخت",
		"موقعیت قفسه",
		"موجودی سیستم",
		"شمارش فیزیکی",
		"مغایرت تعداد",
		"ارزش ریالی مغایرت",
		"علت مغایرت",
		"وضعیت شمارش",
	})
	for idx, it := range view.Items {
		sysStr := "محرمانه"
		if it.SystemQty != nil {
			sysStr = strconv.Itoa(*it.SystemQty)
		}
		physStr := ""
		if it.PhysicalQty != nil {
			physStr = strconv.Itoa(*it.PhysicalQty)
		}
		varQtyStr := ""
		if it.VarianceQty != nil {
			varQtyStr = strconv.Itoa(*it.VarianceQty)
		}
		varRialStr := ""
		if it.VarianceRial != nil {
			varRialStr = strconv.FormatInt(*it.VarianceRial, 10)
		}
		_ = w.Write([]string{
			strconv.Itoa(idx + 1),
			view.CycleCode,
			it.NameFa,
			it.GenericCode,
			it.GTIN,
			it.BatchNo,
			it.LocationLabel,
			sysStr,
			physStr,
			varQtyStr,
			varRialStr,
			it.VarianceReason,
			it.VarianceType,
		})
	}
	w.Flush()
	filename := fmt.Sprintf("stocktake-%s.csv", view.CycleCode)
	return buf.Bytes(), filename, w.Error()
}

func (s *Service) rollbackConfirm(ctx context.Context, undos []batchUndo, movementIDs []string, drugUndos []drugStockUndo) {
	for i := len(undos) - 1; i >= 0; i-- {
		u := undos[i]
		_ = s.shelf.SetBatchQuantityAndStatus(ctx, u.batchID, u.oldQty, u.oldStatus)
	}
	for i := len(drugUndos) - 1; i >= 0; i-- {
		du := drugUndos[i]
		_ = s.drugs.UpdateTotalStock(ctx, du.drugID, du.totalStock)
	}
	if s.cardex != nil {
		for _, id := range movementIDs {
			_ = s.cardex.Delete(ctx, id)
		}
	}
}

func (s *Service) load(ctx context.Context, id string) (Cycle, error) {
	c, err := s.repo.Get(ctx, id)
	if err != nil {
		return Cycle{}, err
	}
	if c == nil {
		return Cycle{}, errormap.NotFound("دوره انبارگردانی یافت نشد")
	}
	if c.Items == nil {
		c.Items = []CycleItem{}
	}
	return *c, nil
}

func (s *Service) loadActive(ctx context.Context, id string) (Cycle, error) {
	c, err := s.load(ctx, id)
	if err != nil {
		return Cycle{}, err
	}
	if c.Status != StatusActive {
		return Cycle{}, errormap.Conflict("فقط دوره فعال قابل ویرایش است")
	}
	return c, nil
}

func (s *Service) replaceActive(ctx context.Context, c Cycle) error {
	ok, err := s.repo.ReplaceIfActive(ctx, c)
	if err != nil {
		return err
	}
	if !ok {
		return errormap.Conflict("فقط دوره فعال قابل ویرایش است")
	}
	return nil
}

func findItemIndex(items []CycleItem, id string) int {
	for i, it := range items {
		if it.ID == id {
			return i
		}
	}
	return -1
}

func cycleCodeAt(now time.Time) string {
	h := strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", "")[:4])
	return fmt.Sprintf("AUD-%s-%s", now.Format("20060102"), h)
}

func adjustmentDocNoAt(now time.Time) string {
	h := strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", "")[:6])
	return fmt.Sprintf("ADJ-%s-%s", now.Format("20060102"), h)
}
