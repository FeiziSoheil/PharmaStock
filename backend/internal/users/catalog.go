package users

import "pharmastock/backend/pkg/errormap"

type RoleDef struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Subtitle  string `json:"subtitle"`
	Highlight bool   `json:"highlight,omitempty"`
}

type PermissionDef struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Group     string `json:"group"`
	Badge     string `json:"badge,omitempty"`
	Sensitive bool   `json:"sensitive,omitempty"`
}

type CellLock struct {
	ForcedValue bool   `json:"forcedValue"`
	Variant     string `json:"variant"` // "exclusive" | "forbidden" | "disabled"
	Label       string `json:"label,omitempty"`
}

// MatrixMap maps permissionId -> roleId -> allowed.
type MatrixMap map[string]map[string]bool

// LockMap maps permissionId -> roleId -> lock rule.
type LockMap map[string]map[string]CellLock

var CanonicalRoles = []RoleDef{
	{ID: "super_admin", Label: "مدیر سامانه / مؤسس", Subtitle: "Super Admin / Owner"},
	{ID: "technical_officer", Label: "داروساز مسئول فنی", Subtitle: "Pharmacist in Charge", Highlight: true},
	{ID: "warehouse_lead", Label: "انباردار داروخانه", Subtitle: "Warehouse Lead"},
	{ID: "dispensing_clerk", Label: "متصدی نسخه و پیشخوان", Subtitle: "Dispensing Clerk"},
}

var CanonicalPermissions = []PermissionDef{
	// Group 1
	{ID: "catalog.view", Label: "مشاهده کاتالوگ فرآورده‌ها و بروشورهای فارماکوپه", Group: "۱. مدیریت کاتالوگ داروها، IRC و شناسه‌ها"},
	{ID: "catalog.create_price", Label: "افزودن داروی جدید به کاتالوگ ژنریک و قیمت‌گذاری مصوب", Group: "۱. مدیریت کاتالوگ داروها، IRC و شناسه‌ها"},
	{ID: "catalog.ttac_sync", Label: "استعلام اصالت برخط تی‌تک (TTAC Webhook Sync)", Group: "۱. مدیریت کاتالوگ داروها، IRC و شناسه‌ها"},
	// Group 2
	{ID: "inventory.view", Label: "مشاهده لحظه‌ای موجودی و سری‌ساخت‌های انبار مرکزی", Group: "۲. انبارداری و جابجایی بین‌قفسه‌ای"},
	{ID: "inventory.transfer", Label: "انتقال دارو بین انبار اصلی و قفسه‌های فعال پیشخوان", Group: "۲. انبارداری و جابجایی بین‌قفسه‌ای"},
	{ID: "inventory.adjust", Label: "ثبت تعدیل دستی موجودی و ضایعات فیزیکی (Manual Adjustment)", Group: "۲. انبارداری و جابجایی بین‌قفسه‌ای"},
	// Group 3
	{ID: "inbound.import_invoice", Label: "بارگذاری اکسل و فایل XML فاکتور شرکت‌های پخش دارویی", Group: "۳. ورود کالا، فاکتور و کاردکس"},
	{ID: "inbound.confirm_receipt", Label: "تأیید نهایی رسید انبار و درج قطعی در کاردکس مالی", Group: "۳. ورود کالا، فاکتور و کاردکس"},
	{ID: "inbound.return_distributor", Label: "صدور فاکتور مرجوعی به شرکت‌های پخش (نقص کیفی یا انقضا)", Group: "۳. ورود کالا، فاکتور و کاردکس"},
	// Group 4
	{ID: "outbound.dispense", Label: "ثبت حواله خروج نسخه بیمه / آزاد و اتصال به پوز", Group: "۴. نسخه‌پیچی، خروج و تحویل بالینی"},
	{ID: "outbound.controlled_approval", Label: "تأییدیه قانونی داروهای تحت کنترل و مخدر", Group: "۴. نسخه‌پیچی، خروج و تحویل بالینی", Badge: "الزام قانونی غذا و دارو", Sensitive: true},
	{ID: "outbound.void_dispense", Label: "ابطال حواله خروج ثبت‌شده و برگشت به قفسه", Group: "۴. نسخه‌پیچی، خروج و تحویل بالینی"},
	// Group 5
	{ID: "stocktake.create", Label: "ایجاد دوره انبارگردانی جدید و قفل موقت رکوردها", Group: "۵. انبارگردانی دوره‌ای و مغایرت‌گیری"},
	{ID: "stocktake.count_entry", Label: "ورود داده‌های شمارش اول و دوم (تگ‌های شمارش انبار)", Group: "۵. انبارگردانی دوره‌ای و مغایرت‌گیری"},
	{ID: "stocktake.approve_adjustment", Label: "تأیید نهایی مغایرت و صدور سند تعدیل کسری / مازاد", Group: "۵. انبارگردانی دوره‌ای و مغایرت‌گیری"},
	// Group 6
	{ID: "audit.view", Label: "مشاهده و جستجو در دفتر لاگ ممیزی (Audit Trail)", Group: "۶. ممیزی، لاگ وقایع و امنیت سیستم"},
	{ID: "security.manage_users", Label: "مدیریت کاربران، تغییر سطوح دسترسی و تخصیص نقش", Group: "۶. ممیزی، لاگ وقایع و امنیت سیستم", Sensitive: true},
}

var validRolesSet = map[string]bool{
	"super_admin":        true,
	"technical_officer":  true,
	"warehouse_lead":     true,
	"dispensing_clerk":   true,
	"warehouse_operator": true,
	"pharmacist":         true,
	"intake_clerk":       true,
}

func IsValidRole(role string) bool {
	return validRolesSet[role]
}

// MatrixRoleFor maps legacy/alias roles to their canonical matrix role column.
func MatrixRoleFor(role string) string {
	switch role {
	case "warehouse_operator":
		return "warehouse_lead"
	case "pharmacist":
		return "technical_officer"
	case "intake_clerk":
		return "dispensing_clerk"
	default:
		return role
	}
}

func IsTechnicalOfficerRole(role string) bool {
	return role == "technical_officer" || role == "pharmacist"
}

func DefaultMatrix() MatrixMap {
	return MatrixMap{
		"catalog.view":                 {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": true},
		"catalog.create_price":         {"super_admin": true, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": false},
		"catalog.ttac_sync":            {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": true},
		"inventory.view":               {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": true},
		"inventory.transfer":           {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": false},
		"inventory.adjust":             {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": false},
		"inbound.import_invoice":       {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": false},
		"inbound.confirm_receipt":      {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": false},
		"inbound.return_distributor":   {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": false},
		"outbound.dispense":            {"super_admin": true, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": true},
		"outbound.controlled_approval": {"super_admin": false, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": false},
		"outbound.void_dispense":       {"super_admin": true, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": false},
		"stocktake.create":             {"super_admin": true, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": false},
		"stocktake.count_entry":        {"super_admin": true, "technical_officer": true, "warehouse_lead": true, "dispensing_clerk": true},
		"stocktake.approve_adjustment": {"super_admin": true, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": false},
		"audit.view":                   {"super_admin": true, "technical_officer": true, "warehouse_lead": false, "dispensing_clerk": false},
		"security.manage_users":        {"super_admin": true, "technical_officer": false, "warehouse_lead": false, "dispensing_clerk": false},
	}
}

func LockedCells() LockMap {
	return LockMap{
		"inventory.adjust": {
			"dispensing_clerk": {ForcedValue: false, Variant: "disabled"},
		},
		"inbound.confirm_receipt": {
			"dispensing_clerk": {ForcedValue: false, Variant: "disabled"},
		},
		"outbound.controlled_approval": {
			"super_admin":       {ForcedValue: false, Variant: "forbidden", Label: "غیرمجاز فنی"},
			"technical_officer": {ForcedValue: true, Variant: "exclusive", Label: "انحصار مسئول فنی"},
			"warehouse_lead":    {ForcedValue: false, Variant: "forbidden", Label: "قفل قانونی"},
			"dispensing_clerk":  {ForcedValue: false, Variant: "forbidden", Label: "قفل قانونی"},
		},
		"stocktake.create": {
			"dispensing_clerk": {ForcedValue: false, Variant: "disabled"},
		},
		"stocktake.approve_adjustment": {
			"warehouse_lead":   {ForcedValue: false, Variant: "disabled"},
			"dispensing_clerk": {ForcedValue: false, Variant: "disabled"},
		},
		"audit.view": {
			"dispensing_clerk": {ForcedValue: false, Variant: "disabled"},
		},
		"security.manage_users": {
			"super_admin":      {ForcedValue: true, Variant: "disabled"},
			"warehouse_lead":   {ForcedValue: false, Variant: "disabled"},
			"dispensing_clerk": {ForcedValue: false, Variant: "disabled"},
		},
	}
}

// NormalizeAndValidateMatrix fills missing cells from defaults and rejects any
// invalid permission/role IDs or Separation-of-Duties lock violations.
func NormalizeAndValidateMatrix(input MatrixMap) (MatrixMap, error) {
	permSet := make(map[string]bool, len(CanonicalPermissions))
	for _, p := range CanonicalPermissions {
		permSet[p.ID] = true
	}
	roleSet := make(map[string]bool, len(CanonicalRoles))
	for _, r := range CanonicalRoles {
		roleSet[r.ID] = true
	}

	for permID, cols := range input {
		if !permSet[permID] {
			return nil, errormap.Validation("شناسه مجوز در ماتریس نامعتبر است", map[string]string{"permission": permID})
		}
		for roleID := range cols {
			if !roleSet[roleID] {
				return nil, errormap.Validation("شناسه نقش در ماتریس نامعتبر است", map[string]string{"role": roleID})
			}
		}
	}

	defaults := DefaultMatrix()
	locks := LockedCells()
	out := make(MatrixMap, len(CanonicalPermissions))

	for _, p := range CanonicalPermissions {
		row := make(map[string]bool, len(CanonicalRoles))
		for _, r := range CanonicalRoles {
			val := defaults[p.ID][r.ID]
			if cols, ok := input[p.ID]; ok {
				if v, exists := cols[r.ID]; exists {
					val = v
				}
			}
			if lockRow, ok := locks[p.ID]; ok {
				if lock, locked := lockRow[r.ID]; locked && val != lock.ForcedValue {
					if p.ID == "outbound.controlled_approval" {
						return nil, errormap.Validation(
							"مطابق قاعده تفکیک وظایف دارویی (IFDA)، تأییدیه داروهای تحت کنترل و مخدر منحصراً در اختیار داروساز مسئول فنی است.",
							map[string]string{"permission": p.ID, "role": r.ID},
						)
					}
					return nil, errormap.Validation(
						"تغییر این مجوز به دلیل الزامات قانونی و کنترل دسترسی مجاز نیست.",
						map[string]string{"permission": p.ID, "role": r.ID},
					)
				}
			}
			row[r.ID] = val
		}
		out[p.ID] = row
	}
	return out, nil
}

func SensitivePermissionCount() int {
	n := 0
	for _, p := range CanonicalPermissions {
		if p.Sensitive {
			n++
		}
	}
	return n
}

func EffectivePermissionsForUser(role string, matrix MatrixMap, overrides map[string]bool) map[string]bool {
	canonRole := MatrixRoleFor(role)
	locks := LockedCells()
	eff := make(map[string]bool, len(CanonicalPermissions))
	for _, p := range CanonicalPermissions {
		val := matrix[p.ID][canonRole]
		if ov, ok := overrides[p.ID]; ok {
			val = ov
		}
		if lockRow, ok := locks[p.ID]; ok {
			if lock, locked := lockRow[canonRole]; locked {
				val = lock.ForcedValue
			}
		}
		eff[p.ID] = val
	}
	return eff
}
