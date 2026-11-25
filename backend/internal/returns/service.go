package returns

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/internal/cardex"
	"pharmastock/backend/internal/drug"
	"pharmastock/backend/internal/shelf"
	"pharmastock/backend/pkg/domain"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

const (
	validationMessage      = "لطفاً اطلاعات مرجوعی را به‌درستی تکمیل کنید"
	confirmConflictMessage = "فقط پیش‌نویس مرجوعی قابل تایید است"
	settleConflictMessage  = "فقط حواله تاییدشده قابل تسویه توسط ویزیتور است"
	urgentThresholdDays    = 25
)

type returnStore interface {
	Insert(ctx context.Context, ret DistributorReturn) error
	Get(ctx context.Context, id string) (*DistributorReturn, error)
	List(ctx context.Context, status, distributorID string, page, pageSize int) ([]DistributorReturn, int64, error)
	CountByStatus(ctx context.Context, status string) (int64, error)
	Replace(ctx context.Context, ret DistributorReturn) error
	ClaimForConfirm(ctx context.Context, id string) (bool, error)
	RevertToDraft(ctx context.Context, id string) error
}

type shelfStore interface {
	AllBatches(ctx context.Context) ([]shelf.StockBatch, error)
	GetBatch(ctx context.Context, id string) (*shelf.StockBatch, error)
	BatchesByDrug(ctx context.Context, drugID string) ([]shelf.StockBatch, error)
	UpdateBatchQuantity(ctx context.Context, id string, quantity int) error
	UpdateBatchStatus(ctx context.Context, id, status string) error
}

type drugStore interface {
	All(ctx context.Context) ([]drug.Drug, error)
	Get(ctx context.Context, id string) (*drug.Drug, error)
	UpdateStockSummary(ctx context.Context, id string, totalStock int, nearestExpiry string) error
}

type cardexWriter interface {
	Append(ctx context.Context, in cardex.AppendInput) (cardex.Movement, error)
	Delete(ctx context.Context, id string) error
}

type auditWriter interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

var (
	_ returnStore  = (*Repository)(nil)
	_ shelfStore   = (*shelf.Repository)(nil)
	_ drugStore    = (*drug.Repository)(nil)
	_ cardexWriter = (*cardex.Service)(nil)
	_ auditWriter  = (*audit.Service)(nil)
)

type distributorMeta struct {
	ID              string
	Name            string
	Code            string
	CustomerCode    string
	VisitorName     string
	DepositLocation string
}

var canonicalDistributors = map[string]distributorMeta{
	"daroupakhsh": {
		ID:              "daroupakhsh",
		Name:            "شرکت توزیع داروپخش",
		Code:            "DP-9411",
		CustomerCode:    "DP-CUST-88401",
		VisitorName:     "مهندس کاظمی (منطقه ۳)",
		DepositLocation: "قفسه استرداد انبار مرکزی (B-12) - برچسب‌گذاری شده با کد قرنطینه",
	},
	"hejrat": {
		ID:              "hejrat",
		Name:            "شرکت پخش هجرت",
		Code:            "HJ-208",
		CustomerCode:    "HJ-CUST-44102",
		VisitorName:     "مهندس سعادتی (منطقه ۱)",
		DepositLocation: "قفسه استرداد انبار مرکزی (C-04) - آماده بسته‌بندی کارتن",
	},
	"razi": {
		ID:              "razi",
		Name:            "شرکت پخش رازی",
		Code:            "RZ-440",
		CustomerCode:    "RZ-CUST-31908",
		VisitorName:     "آقای محمدی (منطقه ۲)",
		DepositLocation: "قفسه داروهای پرمصرف (A-02) - آماده تفکیک مرجوعی",
	},
	"alborz": {
		ID:              "alborz",
		Name:            "شرکت پخش البرز",
		Code:            "AB-512",
		CustomerCode:    "AB-CUST-20415",
		VisitorName:     "خانم نوری (منطقه ۴)",
		DepositLocation: "قفسه استرداد بخش اصلی (B-06)",
	},
	"ferdows": {
		ID:              "ferdows",
		Name:            "شرکت پخش فردوس",
		Code:            "FD-318",
		CustomerCode:    "FD-CUST-19044",
		VisitorName:     "آقای کریمی (منطقه ۱)",
		DepositLocation: "قفسه استرداد بخش اصلی (B-08)",
	},
	"abidi": {
		ID:              "abidi",
		Name:            "پخش داروسازی عبیدی",
		Code:            "OB-105",
		CustomerCode:    "OB-CUST-55820",
		VisitorName:     "آقای حسینی (منطقه ۵)",
		DepositLocation: "قفسه استرداد بخش اصلی (B-10)",
	},
}

var distributorAliases = map[string]string{
	"daroupakhsh":        "daroupakhsh",
	"darou-pakhsh":       "daroupakhsh",
	"داروپخش":            "daroupakhsh",
	"شرکت توزیع داروپخش": "daroupakhsh",
	"پخش داروپخش":        "daroupakhsh",
	"hejrat":             "hejrat",
	"هجرت":               "hejrat",
	"پخش هجرت":           "hejrat",
	"شرکت پخش هجرت":      "hejrat",
	"razi":               "razi",
	"رازی":               "razi",
	"پخش رازی":           "razi",
	"شرکت پخش رازی":      "razi",
	"alborz":             "alborz",
	"البرز":              "alborz",
	"پخش البرز":          "alborz",
	"شرکت پخش البرز":     "alborz",
	"ferdows":            "ferdows",
	"فردوس":              "ferdows",
	"پخش فردوس":          "ferdows",
	"شرکت پخش فردوس":     "ferdows",
	"abidi":              "abidi",
	"عبیدی":              "abidi",
	"داروسازی عبیدی":     "abidi",
	"پخش داروسازی عبیدی": "abidi",
}

type Service struct {
	repo   returnStore
	shelf  shelfStore
	drugs  drugStore
	cardex cardexWriter
	audit  auditWriter
	now    func() time.Time
}

func NewService(repo returnStore, shelfRepo shelfStore, drugRepo drugStore, cardexSvc cardexWriter, auditSvc auditWriter) *Service {
	return &Service{
		repo:   repo,
		shelf:  shelfRepo,
		drugs:  drugRepo,
		cardex: cardexSvc,
		audit:  auditSvc,
		now:    func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) ListEligible(ctx context.Context, windowDays int, search, distributorID string) (EligibilityResponse, error) {
	if windowDays <= 0 || windowDays > 365 {
		windowDays = DefaultWindowDays
	}

	drugs, err := s.drugs.All(ctx)
	if err != nil {
		return EligibilityResponse{}, err
	}
	batches, err := s.shelf.AllBatches(ctx)
	if err != nil {
		return EligibilityResponse{}, err
	}
	pendingVisitor, err := s.repo.CountByStatus(ctx, StatusConfirmed)
	if err != nil {
		return EligibilityResponse{}, err
	}

	drugByID := make(map[string]drug.Drug, len(drugs))
	for _, d := range drugs {
		drugByID[d.ID] = d
	}

	today := s.now()
	searchNorm := validator.NormalizeFa(search)
	filterDist := ""
	if strings.TrimSpace(distributorID) != "" {
		filterDist = resolveDistributor(distributorID, "").ID
	}

	groupMap := make(map[string]*DistributorGroup)
	var kpis SummaryKPIs
	kpis.PendingVisitorSlips = int(pendingVisitor)

	for _, b := range batches {
		if !isBatchReturnableStatus(b.Status) || b.Quantity <= 0 {
			continue
		}
		days, ok := domain.DaysUntilExpiry(b.Expiry, today)
		if !ok {
			continue
		}
		if b.Status != "marked_return" && days > windowDays {
			continue
		}

		d, hasDrug := drugByID[b.DrugID]
		distHint := ""
		if hasDrug {
			distHint = d.DistributorID
		}
		meta := resolveDistributor(b.Distributor, distHint)
		if filterDist != "" && meta.ID != filterDist {
			continue
		}

		item := buildEligibleItem(b, d, hasDrug, meta, days, windowDays)
		if searchNorm != "" && !matchesSearch(item, searchNorm) {
			continue
		}

		grp, exists := groupMap[meta.ID]
		if !exists {
			grp = &DistributorGroup{
				DistributorID:   meta.ID,
				DistributorName: meta.Name,
				DistributorCode: meta.Code,
				CustomerCode:    meta.CustomerCode,
				VisitorName:     meta.VisitorName,
				DepositLocation: meta.DepositLocation,
				NearestDays:     days,
				NearestExpiry:   b.Expiry,
				Items:           []EligibleBatch{},
			}
			groupMap[meta.ID] = grp
		}
		grp.Items = append(grp.Items, item)
		grp.BatchCount++
		grp.TotalQty += item.Quantity
		grp.TotalValueRial += item.TotalValueRial
		if days < grp.NearestDays {
			grp.NearestDays = days
			grp.NearestExpiry = b.Expiry
		}

		kpis.TotalBatches++
		if days <= urgentThresholdDays {
			kpis.UrgentBatches++
		}
		kpis.TotalValueRial += item.TotalValueRial
	}

	groups := make([]DistributorGroup, 0, len(groupMap))
	for _, grp := range groupMap {
		sort.SliceStable(grp.Items, func(i, j int) bool {
			if grp.Items[i].Expiry != grp.Items[j].Expiry {
				return grp.Items[i].Expiry < grp.Items[j].Expiry
			}
			return grp.Items[i].BatchNo < grp.Items[j].BatchNo
		})
		groups = append(groups, *grp)
	}
	sort.SliceStable(groups, func(i, j int) bool {
		if groups[i].NearestDays != groups[j].NearestDays {
			return groups[i].NearestDays < groups[j].NearestDays
		}
		return groups[i].TotalValueRial > groups[j].TotalValueRial
	})

	kpis.ActiveDistributors = len(groups)
	kpis.DistributorNames = make([]string, 0, len(groups))
	for _, grp := range groups {
		kpis.DistributorNames = append(kpis.DistributorNames, grp.DistributorName)
	}

	return EligibilityResponse{
		WindowDays: windowDays,
		TodayISO:   today.UTC().Format("2006-01-02"),
		KPIs:       kpis,
		Groups:     groups,
	}, nil
}

func (s *Service) Create(ctx context.Context, req CreateRequest, actor requestctx.Actor) (ReturnView, error) {
	if len(req.Lines) == 0 {
		return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
			"lines": "حداقل یک سری ساخت برای مرجوعی انتخاب کنید",
		})
	}

	windowDays := req.WindowDays
	if windowDays <= 0 || windowDays > 365 {
		windowDays = DefaultWindowDays
	}

	lines := make([]ReturnLine, 0, len(req.Lines))
	stagedByBatch := make(map[string]int)
	var resolvedMeta *distributorMeta
	if strings.TrimSpace(req.DistributorID) != "" {
		m := resolveDistributor(req.DistributorID, "")
		resolvedMeta = &m
	}

	var totalQty int
	var totalValue int64

	for i, in := range req.Lines {
		batchID := strings.TrimSpace(in.BatchID)
		if batchID == "" {
			return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
				fmt.Sprintf("lines[%d].batchId", i): "شناسه بچ الزامی است",
			})
		}
		if in.Quantity <= 0 {
			return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
				fmt.Sprintf("lines[%d].quantity", i): "تعداد مرجوعی باید بزرگ‌تر از صفر باشد",
			})
		}
		batch, err := s.shelf.GetBatch(ctx, batchID)
		if err != nil {
			return ReturnView{}, err
		}
		if batch == nil {
			return ReturnView{}, errormap.NotFound("بچ موجودی یافت نشد")
		}
		if !isBatchReturnableStatus(batch.Status) {
			return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
				"batchId": "این سری ساخت در وضعیت قابل مرجوعی نیست",
			})
		}
		if stagedByBatch[batch.ID]+in.Quantity > batch.Quantity {
			return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
				"quantity": "تعداد درخواستی بیش از موجودی قابل مرجوع بچ است",
			})
		}
		stagedByBatch[batch.ID] += in.Quantity

		var d drug.Drug
		var hasDrug bool
		if batch.DrugID != "" && s.drugs != nil {
			found, err := s.drugs.Get(ctx, batch.DrugID)
			if err != nil {
				return ReturnView{}, err
			}
			if found != nil {
				d = *found
				hasDrug = true
			}
		}

		distHint := ""
		if hasDrug {
			distHint = d.DistributorID
		}
		batchMeta := resolveDistributor(batch.Distributor, distHint)
		if resolvedMeta == nil {
			resolvedMeta = &batchMeta
		} else if resolvedMeta.ID != batchMeta.ID {
			return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
				"distributorId": "تمام اقلام یک برگه مرجوعی باید متعلق به یک شرکت پخش باشند",
			})
		}

		buyPrice := resolveBuyPrice(*batch, d, hasDrug)
		lineTotal := int64(in.Quantity) * buyPrice
		unit := strings.TrimSpace(batch.UnitLabel)
		if unit == "" && hasDrug {
			unit = strings.TrimSpace(d.UnitLabel)
		}
		if unit == "" {
			unit = "عدد"
		}
		manufacturer := strings.TrimSpace(batch.Manufacturer)
		if manufacturer == "" && hasDrug {
			manufacturer = strings.TrimSpace(d.Manufacturer)
		}
		irc := ""
		dosageForm := ""
		strength := ""
		if hasDrug {
			irc = firstNonEmpty(d.GenericCode, d.GTIN)
			dosageForm = d.DosageForm
			strength = d.Strength
		}
		days, _ := domain.DaysUntilExpiry(batch.Expiry, s.now())
		reason := strings.TrimSpace(in.Reason)
		if reason == "" {
			reason = defaultContractReason(batch.Status, days, windowDays)
		}

		lines = append(lines, ReturnLine{
			ID:            uuid.NewString(),
			BatchID:       batch.ID,
			DrugID:        batch.DrugID,
			NameFa:        firstNonEmpty(batch.NameFa, d.NameFa),
			DosageForm:    dosageForm,
			Strength:      strength,
			Manufacturer:  manufacturer,
			IRC:           irc,
			BatchNo:       batch.BatchNo,
			Expiry:        batch.Expiry,
			Quantity:      in.Quantity,
			AvailableQty:  batch.Quantity,
			UnitLabel:     unit,
			BuyPriceRial:  buyPrice,
			LineTotalRial: lineTotal,
			LocationLabel: batch.LocationLabel,
			Reason:        reason,
			IsControlled:  batch.IsControlled || (hasDrug && d.IsControlled),
		})
		totalQty += in.Quantity
		totalValue += lineTotal
	}

	visitorName := strings.TrimSpace(req.VisitorName)
	if visitorName == "" {
		visitorName = resolvedMeta.VisitorName
	}

	now := s.now()
	ret := DistributorReturn{
		ID:              uuid.NewString(),
		Status:          StatusDraft,
		DistributorID:   resolvedMeta.ID,
		DistributorName: resolvedMeta.Name,
		DistributorCode: resolvedMeta.Code,
		CustomerCode:    resolvedMeta.CustomerCode,
		VisitorName:     visitorName,
		WindowDays:      windowDays,
		Note:            strings.TrimSpace(req.Note),
		Lines:           lines,
		TotalQty:        totalQty,
		TotalValueRial:  totalValue,
		CreatedBy: CreatedBy{
			UserID: actor.UserID,
			Name:   actor.Name,
			Role:   actor.Role,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Insert(ctx, ret); err != nil {
		return ReturnView{}, err
	}
	return toView(ret), nil
}

func (s *Service) Get(ctx context.Context, id string) (ReturnView, error) {
	ret, err := s.load(ctx, id)
	if err != nil {
		return ReturnView{}, err
	}
	return toView(ret), nil
}

func (s *Service) List(ctx context.Context, status, distributorID string, p pagination.Params) (pagination.Result[ReturnView], error) {
	if distributorID != "" {
		distributorID = resolveDistributor(distributorID, "").ID
	}
	items, total, err := s.repo.List(ctx, strings.TrimSpace(status), distributorID, p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[ReturnView]{}, err
	}
	views := make([]ReturnView, 0, len(items))
	for _, item := range items {
		views = append(views, toView(item))
	}
	return pagination.Wrap(views, int(total), p.Page, p.PageSize), nil
}

type batchUndo struct {
	batchID    string
	prevQty    int
	prevStatus string
	zeroed     bool
}

type drugSummaryUndo struct {
	drugID        string
	prevTotal     int
	prevNearestEx string
}

func (s *Service) Confirm(ctx context.Context, id string, actor requestctx.Actor, ip string) (ReturnView, error) {
	ret, err := s.load(ctx, id)
	if err != nil {
		return ReturnView{}, err
	}
	if ret.Status != StatusDraft {
		return ReturnView{}, errormap.Conflict(confirmConflictMessage)
	}
	if len(ret.Lines) == 0 {
		return ReturnView{}, errormap.Validation(validationMessage, map[string]string{
			"lines": "حداقل یک قلم الزامی است",
		})
	}

	claimed, err := s.repo.ClaimForConfirm(ctx, id)
	if err != nil {
		return ReturnView{}, err
	}
	if !claimed {
		return ReturnView{}, errormap.Conflict(confirmConflictMessage)
	}

	var batchUndos []batchUndo
	var drugUndos []drugSummaryUndo
	var movementIDs []string

	abort := func(cause error) (ReturnView, error) {
		s.rollbackConfirm(ctx, batchUndos, drugUndos, movementIDs)
		_ = s.repo.RevertToDraft(ctx, id)
		return ReturnView{}, cause
	}

	// Pre-validate cumulative demand per batch against current live stock.
	remainingByBatch := make(map[string]int, len(ret.Lines))
	for i, line := range ret.Lines {
		batch, err := s.shelf.GetBatch(ctx, line.BatchID)
		if err != nil {
			return abort(err)
		}
		if batch == nil {
			return abort(errormap.NotFound("بچ موجودی یافت نشد"))
		}
		if !isBatchReturnableStatus(batch.Status) {
			return abort(errormap.Validation(validationMessage, map[string]string{
				fmt.Sprintf("lines[%d].batchId", i): "وضعیت این سری ساخت اجازه مرجوعی نمی‌دهد",
			}))
		}
		avail, seen := remainingByBatch[batch.ID]
		if !seen {
			avail = batch.Quantity
		}
		if line.Quantity <= 0 || line.Quantity > avail {
			return abort(errormap.Validation(validationMessage, map[string]string{
				fmt.Sprintf("lines[%d].quantity", i): "موجودی سری ساخت برای مرجوعی کافی نیست",
			}))
		}
		remainingByBatch[batch.ID] = avail - line.Quantity
	}

	now := s.now()
	no := returnNoAt(now, ret.ID)
	controlled := false
	affectedDrugs := make(map[string]struct{})

	for _, line := range ret.Lines {
		batch, err := s.shelf.GetBatch(ctx, line.BatchID)
		if err != nil {
			return abort(err)
		}
		if batch == nil {
			return abort(errormap.NotFound("بچ موجودی یافت نشد"))
		}
		newQty := batch.Quantity - line.Quantity
		batchUndos = append(batchUndos, batchUndo{
			batchID:    batch.ID,
			prevQty:    batch.Quantity,
			prevStatus: batch.Status,
			zeroed:     newQty <= 0,
		})
		if err := s.shelf.UpdateBatchQuantity(ctx, batch.ID, newQty); err != nil {
			return abort(err)
		}
		if batch.IsControlled || line.IsControlled {
			controlled = true
		}
		if line.DrugID != "" {
			affectedDrugs[line.DrugID] = struct{}{}
		}
		if s.cardex != nil {
			mv, err := s.cardex.Append(ctx, cardex.AppendInput{
				DrugID:     line.DrugID,
				Type:       "outbound",
				BatchNo:    line.BatchNo,
				QtyIn:      0,
				QtyOut:     line.Quantity,
				ActorName:  actor.Name,
				ShiftLabel: "صبح",
				Note:       fmt.Sprintf("مرجوعی به %s — حواله %s", ret.DistributorName, no),
				At:         now,
			})
			if err != nil {
				return abort(err)
			}
			movementIDs = append(movementIDs, mv.ID)
		}
	}

	// Sync drugs.totalStock & nearestExpiry from live stock_batches.
	if s.drugs != nil {
		for drugID := range affectedDrugs {
			curDrug, err := s.drugs.Get(ctx, drugID)
			if err != nil {
				return abort(err)
			}
			if curDrug == nil {
				continue
			}
			drugBatches, err := s.shelf.BatchesByDrug(ctx, drugID)
			if err != nil {
				return abort(err)
			}
			totalStock, nearestExp := computeDrugStockSummary(drugBatches, now)
			drugUndos = append(drugUndos, drugSummaryUndo{
				drugID:        drugID,
				prevTotal:     curDrug.TotalStock,
				prevNearestEx: curDrug.NearestExpiry,
			})
			if err := s.drugs.UpdateStockSummary(ctx, drugID, totalStock, nearestExp); err != nil {
				return abort(err)
			}
		}
	}

	if s.audit != nil {
		_, err := s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      "return_to_distributor",
			EntityType:  "return",
			EntityID:    ret.ID,
			EntityLabel: fmt.Sprintf("%s — %s", no, ret.DistributorName),
			Description: fmt.Sprintf("صدور و تایید برگه مرجوعی به %s (%d قلم، مبلغ %d ریال)", ret.DistributorName, len(ret.Lines), ret.TotalValueRial),
			After: map[string]any{
				"returnNo":       no,
				"distributorId":  ret.DistributorID,
				"lineCount":      len(ret.Lines),
				"totalQty":       ret.TotalQty,
				"totalValueRial": ret.TotalValueRial,
			},
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: controlled,
		})
		if err != nil {
			return abort(err)
		}
	}

	ret.Status = StatusConfirmed
	ret.ReturnNo = no
	ret.ConfirmedAt = &now
	ret.UpdatedAt = now
	if err := s.repo.Replace(ctx, ret); err != nil {
		return abort(err)
	}
	return toView(ret), nil
}

func (s *Service) Settle(ctx context.Context, id string, req SettleRequest, actor requestctx.Actor, ip string) (ReturnView, error) {
	ret, err := s.load(ctx, id)
	if err != nil {
		return ReturnView{}, err
	}
	if ret.Status != StatusConfirmed {
		return ReturnView{}, errormap.Conflict(settleConflictMessage)
	}

	now := s.now()
	if v := strings.TrimSpace(req.VisitorName); v != "" {
		ret.VisitorName = v
	}
	if c := strings.TrimSpace(req.CreditNoteNo); c != "" {
		ret.CreditNoteNo = c
	}
	if n := strings.TrimSpace(req.Note); n != "" {
		ret.Note = n
	}
	ret.Status = StatusSettled
	ret.SettledAt = &now
	ret.UpdatedAt = now

	if err := s.repo.Replace(ctx, ret); err != nil {
		return ReturnView{}, err
	}

	if s.audit != nil {
		controlled := false
		for _, l := range ret.Lines {
			if l.IsControlled {
				controlled = true
				break
			}
		}
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:       audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
			Action:      "return_to_distributor",
			EntityType:  "return",
			EntityID:    ret.ID,
			EntityLabel: fmt.Sprintf("%s — %s", ret.ReturnNo, ret.DistributorName),
			Description: fmt.Sprintf("تایید تحویل و تسویه بستانکاری مرجوعی توسط ویزیتور %s", ret.DistributorName),
			After: map[string]any{
				"status":       StatusSettled,
				"visitorName":  ret.VisitorName,
				"creditNoteNo": ret.CreditNoteNo,
			},
			IP:                    ip,
			BranchID:              actor.BranchID,
			IsControlledSubstance: controlled,
		})
	}
	return toView(ret), nil
}

func (s *Service) load(ctx context.Context, id string) (DistributorReturn, error) {
	ret, err := s.repo.Get(ctx, id)
	if err != nil {
		return DistributorReturn{}, err
	}
	if ret == nil {
		return DistributorReturn{}, errormap.NotFound("برگه مرجوعی یافت نشد")
	}
	return *ret, nil
}

func (s *Service) rollbackConfirm(ctx context.Context, batchUndos []batchUndo, drugUndos []drugSummaryUndo, movementIDs []string) {
	for i := len(batchUndos) - 1; i >= 0; i-- {
		u := batchUndos[i]
		_ = s.shelf.UpdateBatchQuantity(ctx, u.batchID, u.prevQty)
		if u.zeroed && u.prevStatus != "" {
			_ = s.shelf.UpdateBatchStatus(ctx, u.batchID, u.prevStatus)
		}
	}
	if s.drugs != nil {
		for i := len(drugUndos) - 1; i >= 0; i-- {
			du := drugUndos[i]
			_ = s.drugs.UpdateStockSummary(ctx, du.drugID, du.prevTotal, du.prevNearestEx)
		}
	}
	if s.cardex != nil {
		for _, id := range movementIDs {
			_ = s.cardex.Delete(ctx, id)
		}
	}
}

func isBatchReturnableStatus(status string) bool {
	switch status {
	case "", "active", "marked_return", "relocated", "quick_sale":
		return true
	default:
		return false
	}
}

func resolveDistributor(rawBatchDist, drugDistID string) distributorMeta {
	for _, candidate := range []string{rawBatchDist, drugDistID} {
		trimmed := strings.TrimSpace(candidate)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if canonicalID, ok := distributorAliases[key]; ok {
			return canonicalDistributors[canonicalID]
		}
		norm := validator.NormalizeFa(trimmed)
		if canonicalID, ok := distributorAliases[norm]; ok {
			return canonicalDistributors[canonicalID]
		}
		return distributorMeta{
			ID:              "custom-" + norm,
			Name:            trimmed,
			Code:            "DIST-CUSTOM",
			CustomerCode:    "PH-CUST-100",
			VisitorName:     "نماینده رسمی شرکت پخش",
			DepositLocation: "قفسه استرداد انبار مرکزی",
		}
	}
	return distributorMeta{
		ID:              "other",
		Name:            "سایر شرکت‌های پخش",
		Code:            "DIST-OTHER",
		CustomerCode:    "PH-CUST-000",
		VisitorName:     "نماینده شرکت پخش",
		DepositLocation: "قفسه استرداد انبار مرکزی",
	}
}

func resolveBuyPrice(b shelf.StockBatch, d drug.Drug, hasDrug bool) int64 {
	if b.BuyPriceRial > 0 {
		return int64(b.BuyPriceRial)
	}
	if hasDrug && d.UnitCost > 0 {
		return int64(d.UnitCost)
	}
	if b.ConsumerPriceRial > 0 {
		return int64(b.ConsumerPriceRial)
	}
	return 0
}

func buildEligibleItem(b shelf.StockBatch, d drug.Drug, hasDrug bool, meta distributorMeta, days, windowDays int) EligibleBatch {
	buyPrice := resolveBuyPrice(b, d, hasDrug)
	unit := strings.TrimSpace(b.UnitLabel)
	if unit == "" && hasDrug {
		unit = strings.TrimSpace(d.UnitLabel)
	}
	if unit == "" {
		unit = "عدد"
	}
	manufacturer := strings.TrimSpace(b.Manufacturer)
	if manufacturer == "" && hasDrug {
		manufacturer = strings.TrimSpace(d.Manufacturer)
	}
	irc := ""
	dosageForm := ""
	strength := ""
	if hasDrug {
		irc = firstNonEmpty(d.GenericCode, d.GTIN)
		dosageForm = d.DosageForm
		strength = d.Strength
	}
	urgency := "watch"
	switch {
	case days < 0:
		urgency = "expired"
	case days <= urgentThresholdDays:
		urgency = "urgent"
	case days <= 90:
		urgency = "golden"
	}

	return EligibleBatch{
		BatchID:         b.ID,
		DrugID:          b.DrugID,
		NameFa:          firstNonEmpty(b.NameFa, d.NameFa),
		DosageForm:      dosageForm,
		Strength:        strength,
		Manufacturer:    manufacturer,
		IRC:             irc,
		BatchNo:         b.BatchNo,
		Expiry:          b.Expiry,
		DaysUntilExpiry: days,
		Quantity:        b.Quantity,
		UnitLabel:       unit,
		BuyPriceRial:    buyPrice,
		TotalValueRial:  int64(b.Quantity) * buyPrice,
		Status:          b.Status,
		LocationLabel:   b.LocationLabel,
		DistributorID:   meta.ID,
		DistributorName: meta.Name,
		ContractReason:  defaultContractReason(b.Status, days, windowDays),
		Urgency:         urgency,
		IsControlled:    b.IsControlled || (hasDrug && d.IsControlled),
	}
}

func defaultContractReason(status string, days, windowDays int) string {
	if status == "marked_return" {
		return "علامت‌گذاری‌شده در پایش انقضا جهت استرداد به پخش"
	}
	if days < 0 {
		return "سررسید گذشته؛ نیازمند تاییدیه ویژه شرکت پخش"
	}
	if days <= urgentThresholdDays {
		return fmt.Sprintf("ورود به بازه فوری زیر %d روز تا ممنوعیت مرجوعی (ماده ۴)", urgentThresholdDays)
	}
	if days <= 90 {
		return "بازه طلایی استرداد پیش از پایان مهلت ۳ ماهه قرارداد"
	}
	return fmt.Sprintf("ورود به بازه پایش مرجوعی %d روزه طبق توافق پخش", windowDays)
}

func matchesSearch(item EligibleBatch, searchNorm string) bool {
	return strings.Contains(validator.NormalizeFa(item.NameFa), searchNorm) ||
		strings.Contains(strings.ToLower(item.BatchNo), searchNorm) ||
		strings.Contains(strings.ToLower(item.IRC), searchNorm) ||
		strings.Contains(validator.NormalizeFa(item.Manufacturer), searchNorm) ||
		strings.Contains(validator.NormalizeFa(item.DistributorName), searchNorm)
}

func computeDrugStockSummary(batches []shelf.StockBatch, today time.Time) (int, string) {
	like := make([]domain.ExpiryBatchLike, 0, len(batches))
	nearest := ""
	for _, b := range batches {
		if b.Status == "quarantined" || b.Status == "depleted" || b.Status == "returned" || b.Quantity <= 0 {
			continue
		}
		like = append(like, domain.ExpiryBatchLike{Quantity: b.Quantity, Expiry: b.Expiry})
		if nearest == "" || b.Expiry < nearest {
			nearest = b.Expiry
		}
	}
	return domain.SumUsableQuantity(like, today), nearest
}

func returnNoAt(now time.Time, id string) string {
	short := strings.ToUpper(strings.ReplaceAll(id, "-", ""))
	if len(short) > 4 {
		short = short[:4]
	}
	return fmt.Sprintf("RET-%s-%s", now.UTC().Format("20060102"), short)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}
