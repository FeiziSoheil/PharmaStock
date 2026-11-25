package users

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

type AuditLogger interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

type Service struct {
	repo  Repository
	audit AuditLogger
}

func NewService(repo Repository, auditSvc AuditLogger) *Service {
	return &Service{repo: repo, audit: auditSvc}
}

var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9._-]{3,40}$`)
	emailRe    = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

func (s *Service) List(ctx context.Context, search, role, status, branchID string, p pagination.Params) (UsersListResponse, error) {
	items, total, err := s.repo.ListUsers(ctx, ListFilter{
		Search:   validator.NormalizeFa(search),
		Role:     strings.TrimSpace(role),
		Status:   strings.TrimSpace(status),
		BranchID: strings.TrimSpace(branchID),
		SortBy:   p.SortBy,
		SortDir:  p.SortDir,
		Page:     p.Page,
		PageSize: p.PageSize,
	})
	if err != nil {
		return UsersListResponse{}, err
	}
	totUsers, activeUsers, techOfficers, err := s.repo.CountKPIs(ctx)
	if err != nil {
		return UsersListResponse{}, err
	}
	branches, err := s.repo.ListBranches(ctx)
	if err != nil {
		return UsersListResponse{}, err
	}
	lastAudit, err := s.repo.LastAccessAuditTime(ctx)
	if err != nil {
		return UsersListResponse{}, err
	}
	dtos := make([]UserDTO, 0, len(items))
	for _, u := range items {
		dtos = append(dtos, toUserDTO(u))
	}
	return UsersListResponse{
		Result: pagination.Wrap(dtos, int(total), p.Page, p.PageSize),
		KPIs: KPIs{
			TotalUsers:           totUsers,
			ActiveUsers:          activeUsers,
			TechnicalOfficers:    techOfficers,
			SensitivePermissions: SensitivePermissionCount(),
			LastAccessChangeAt:   lastAudit,
			AuditCoveragePercent: 100,
		},
		Branches: branches,
	}, nil
}

func (s *Service) Get(ctx context.Context, id string) (UserDetailDTO, error) {
	u, err := s.repo.FindUserByID(ctx, id)
	if err != nil {
		return UserDetailDTO{}, err
	}
	if u == nil {
		return UserDetailDTO{}, errormap.NotFound("کاربر یافت نشد")
	}
	matrix, _, err := s.loadMatrix(ctx)
	if err != nil {
		return UserDetailDTO{}, err
	}
	return UserDetailDTO{
		UserDTO:              toUserDTO(*u),
		EffectivePermissions: EffectivePermissionsForUser(u.Role, matrix, u.CustomPermissions),
	}, nil
}

func (s *Service) Create(ctx context.Context, req CreateUserRequest, actor requestctx.Actor, ip string) (UserDTO, error) {
	req.Username = strings.TrimSpace(req.Username)
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Phone = strings.TrimSpace(req.Phone)
	req.PersonnelCode = strings.TrimSpace(req.PersonnelCode)
	req.MedicalCouncilNo = strings.TrimSpace(req.MedicalCouncilNo)
	req.Role = strings.TrimSpace(req.Role)
	req.BranchID = strings.TrimSpace(req.BranchID)
	req.UnitLabel = strings.TrimSpace(req.UnitLabel)

	fields := validateUserFields(req.Name, req.Email, req.Phone, req.Role, req.PersonnelCode)
	if !usernameRe.MatchString(req.Username) {
		fields["username"] = "نام کاربری باید بین ۳ تا ۴۰ کاراکتر انگلیسی، عدد، نقطه یا خط تیره باشد"
	}
	if len(req.Password) < 8 {
		fields["password"] = "رمز عبور اولیه باید حداقل ۸ کاراکتر باشد"
	}
	if len(fields) > 0 {
		return UserDTO{}, errormap.Validation("لطفاً اطلاعات کاربر را به‌درستی تکمیل کنید", fields)
	}

	if req.BranchID != "" {
		b, err := s.repo.FindBranch(ctx, req.BranchID)
		if err != nil {
			return UserDTO{}, err
		}
		if b == nil {
			return UserDTO{}, errormap.Validation("شعبه انتخاب‌شده معتبر نیست", map[string]string{"branchId": "شعبه یافت نشد"})
		}
	} else {
		req.BranchID = "branch-central"
	}

	existing, err := s.repo.FindUserByUsername(ctx, req.Username)
	if err != nil {
		return UserDTO{}, err
	}
	if existing != nil {
		return UserDTO{}, errormap.Conflict("نام کاربری قبلاً در سامانه ثبت شده است")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return UserDTO{}, err
	}

	status := "active"
	if req.Active != nil && !*req.Active {
		status = "inactive"
	}
	now := time.Now().UTC()
	u := UserRecord{
		ID:               "user-" + uuid.NewString(),
		Username:         req.Username,
		Name:             req.Name,
		NameNorm:         validator.NormalizeFa(req.Name),
		Email:            req.Email,
		Phone:            req.Phone,
		PersonnelCode:    req.PersonnelCode,
		MedicalCouncilNo: req.MedicalCouncilNo,
		Role:             req.Role,
		BranchID:         req.BranchID,
		UnitLabel:        req.UnitLabel,
		Status:           status,
		PasswordHash:     string(hash),
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.repo.InsertUser(ctx, u); err != nil {
		return UserDTO{}, err
	}

	s.recordAccessAudit(ctx, actor, ip, u.ID, u.Name, "ایجاد حساب کاربری جدید و تخصیص نقش", nil, map[string]any{
		"username": u.Username,
		"role":     u.Role,
		"status":   u.Status,
		"branchId": u.BranchID,
	})

	return toUserDTO(u), nil
}

func (s *Service) Update(ctx context.Context, id string, req UpdateUserRequest, actor requestctx.Actor, ip string) (UserDTO, error) {
	u, err := s.repo.FindUserByID(ctx, id)
	if err != nil {
		return UserDTO{}, err
	}
	if u == nil {
		return UserDTO{}, errormap.NotFound("کاربر یافت نشد")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Phone = strings.TrimSpace(req.Phone)
	req.PersonnelCode = strings.TrimSpace(req.PersonnelCode)
	req.MedicalCouncilNo = strings.TrimSpace(req.MedicalCouncilNo)
	req.Role = strings.TrimSpace(req.Role)
	req.BranchID = strings.TrimSpace(req.BranchID)
	req.UnitLabel = strings.TrimSpace(req.UnitLabel)

	fields := validateUserFields(req.Name, req.Email, req.Phone, req.Role, req.PersonnelCode)
	if len(fields) > 0 {
		return UserDTO{}, errormap.Validation("لطفاً اطلاعات کاربر را به‌درستی تکمیل کنید", fields)
	}
	if req.BranchID != "" {
		b, err := s.repo.FindBranch(ctx, req.BranchID)
		if err != nil {
			return UserDTO{}, err
		}
		if b == nil {
			return UserDTO{}, errormap.Validation("شعبه انتخاب‌شده معتبر نیست", map[string]string{"branchId": "شعبه یافت نشد"})
		}
	}

	nextStatus := u.Status
	if nextStatus == "" {
		nextStatus = "active"
	}
	if req.Active != nil {
		if *req.Active {
			nextStatus = "active"
			u.PermanentlyLocked = false
		} else {
			if u.ID == actor.UserID {
				return UserDTO{}, errormap.Validation("امکان غیرفعال‌سازی حساب کاربری جاری خودتان وجود ندارد", map[string]string{"active": "نامعتبر"})
			}
			nextStatus = "inactive"
		}
	}

	// Guard against removing the last active super_admin.
	if u.Role == "super_admin" && (req.Role != "super_admin" || nextStatus != "active") {
		others, err := s.repo.CountActiveSuperAdmins(ctx, u.ID)
		if err != nil {
			return UserDTO{}, err
		}
		if others == 0 {
			return UserDTO{}, errormap.Validation("حداقل یک مدیر سامانه فعال باید در سیستم باقی بماند", map[string]string{"role": "الزامی"})
		}
	}

	before := map[string]any{
		"name":      u.Name,
		"role":      u.Role,
		"status":    u.Status,
		"unitLabel": u.UnitLabel,
	}

	u.Name = req.Name
	u.NameNorm = validator.NormalizeFa(req.Name)
	u.Email = req.Email
	u.Phone = req.Phone
	u.PersonnelCode = req.PersonnelCode
	u.MedicalCouncilNo = req.MedicalCouncilNo
	u.Role = req.Role
	if req.BranchID != "" {
		u.BranchID = req.BranchID
	}
	u.UnitLabel = req.UnitLabel
	u.Status = nextStatus
	u.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateUser(ctx, *u); err != nil {
		return UserDTO{}, err
	}

	s.recordAccessAudit(ctx, actor, ip, u.ID, u.Name, "ویرایش مشخصات و نقش کاربر", before, map[string]any{
		"name":      u.Name,
		"role":      u.Role,
		"status":    u.Status,
		"unitLabel": u.UnitLabel,
	})

	return toUserDTO(*u), nil
}

func (s *Service) UpdateStatus(ctx context.Context, id string, req UpdateStatusRequest, actor requestctx.Actor, ip string) (UserDTO, error) {
	u, err := s.repo.FindUserByID(ctx, id)
	if err != nil {
		return UserDTO{}, err
	}
	if u == nil {
		return UserDTO{}, errormap.NotFound("کاربر یافت نشد")
	}
	if !req.Active && u.ID == actor.UserID {
		return UserDTO{}, errormap.Validation("امکان غیرفعال‌سازی حساب کاربری جاری خودتان وجود ندارد", map[string]string{"active": "نامعتبر"})
	}
	if !req.Active && u.Role == "super_admin" {
		others, err := s.repo.CountActiveSuperAdmins(ctx, u.ID)
		if err != nil {
			return UserDTO{}, err
		}
		if others == 0 {
			return UserDTO{}, errormap.Validation("حداقل یک مدیر سامانه فعال باید در سیستم باقی بماند", map[string]string{"active": "الزامی"})
		}
	}

	prevStatus := u.Status
	if prevStatus == "" {
		prevStatus = "active"
	}
	if req.Active {
		u.Status = "active"
		u.PermanentlyLocked = false
		u.FailedAttempts = 0
		u.LockUntil = nil
	} else {
		u.Status = "inactive"
	}
	u.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateUser(ctx, *u); err != nil {
		return UserDTO{}, err
	}

	desc := "غیرفعال‌سازی حساب کاربری"
	if req.Active {
		desc = "فعال‌سازی حساب کاربری"
	}
	s.recordAccessAudit(ctx, actor, ip, u.ID, u.Name, desc,
		map[string]any{"status": prevStatus},
		map[string]any{"status": u.Status},
	)

	return toUserDTO(*u), nil
}

func (s *Service) UpdateUserPermissions(ctx context.Context, id string, req UpdateUserPermissionsRequest, actor requestctx.Actor, ip string) (UserDetailDTO, error) {
	u, err := s.repo.FindUserByID(ctx, id)
	if err != nil {
		return UserDetailDTO{}, err
	}
	if u == nil {
		return UserDetailDTO{}, errormap.NotFound("کاربر یافت نشد")
	}

	permSet := make(map[string]bool, len(CanonicalPermissions))
	for _, p := range CanonicalPermissions {
		permSet[p.ID] = true
	}

	canonRole := MatrixRoleFor(u.Role)
	locks := LockedCells()

	next := make(map[string]bool)
	for k, v := range u.CustomPermissions {
		next[k] = v
	}

	for permID, ptr := range req.Overrides {
		if !permSet[permID] {
			return UserDetailDTO{}, errormap.Validation("شناسه مجوز نامعتبر است", map[string]string{"permission": permID})
		}
		if ptr == nil {
			delete(next, permID)
			continue
		}
		if lockRow, ok := locks[permID]; ok {
			if lock, locked := lockRow[canonRole]; locked && *ptr != lock.ForcedValue {
				if permID == "outbound.controlled_approval" && !IsTechnicalOfficerRole(u.Role) {
					return UserDetailDTO{}, errormap.Validation(
						"مطابق ضوابط سازمان غذا و دارو، مجوز تأیید داروهای تحت کنترل و مخدر فقط برای داروساز مسئول فنی مجاز است.",
						map[string]string{"permission": permID},
					)
				}
				return UserDetailDTO{}, errormap.Validation(
					"تغییر این مجوز اختصاصی به دلیل الزام قانونی تفکیک وظایف مجاز نیست.",
					map[string]string{"permission": permID},
				)
			}
		}
		next[permID] = *ptr
	}

	beforeCount := len(u.CustomPermissions)
	if len(next) == 0 {
		u.CustomPermissions = nil
	} else {
		u.CustomPermissions = next
	}
	u.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateUser(ctx, *u); err != nil {
		return UserDetailDTO{}, err
	}

	s.recordAccessAudit(ctx, actor, ip, u.ID, u.Name, "تنظیم مجوزهای اختصاصی کاربر",
		map[string]any{"overrideCount": beforeCount},
		map[string]any{"overrideCount": len(u.CustomPermissions)},
	)

	matrix, _, err := s.loadMatrix(ctx)
	if err != nil {
		return UserDetailDTO{}, err
	}
	return UserDetailDTO{
		UserDTO:              toUserDTO(*u),
		EffectivePermissions: EffectivePermissionsForUser(u.Role, matrix, u.CustomPermissions),
	}, nil
}

func (s *Service) ResetPassword(ctx context.Context, id string, req ResetPasswordRequest, actor requestctx.Actor, ip string) (UserDTO, error) {
	u, err := s.repo.FindUserByID(ctx, id)
	if err != nil {
		return UserDTO{}, err
	}
	if u == nil {
		return UserDTO{}, errormap.NotFound("کاربر یافت نشد")
	}
	if len(req.NewPassword) < 8 {
		return UserDTO{}, errormap.Validation("رمز عبور جدید باید حداقل ۸ کاراکتر باشد", map[string]string{"newPassword": "حداقل ۸ کاراکتر الزامی است"})
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return UserDTO{}, err
	}
	u.PasswordHash = string(hash)
	u.FailedAttempts = 0
	u.LockUntil = nil
	if req.Unlock {
		u.PermanentlyLocked = false
		u.Status = "active"
	}
	u.UpdatedAt = time.Now().UTC()

	if err := s.repo.UpdateUser(ctx, *u); err != nil {
		return UserDTO{}, err
	}

	s.recordAccessAudit(ctx, actor, ip, u.ID, u.Name, "بازنشانی رمز عبور کاربر", nil, map[string]any{
		"unlocked": req.Unlock,
	})

	return toUserDTO(*u), nil
}

func (s *Service) GetMatrix(ctx context.Context) (MatrixResponse, error) {
	matrix, policy, err := s.loadMatrix(ctx)
	if err != nil {
		return MatrixResponse{}, err
	}
	res := MatrixResponse{
		Roles:       CanonicalRoles,
		Permissions: CanonicalPermissions,
		Matrix:      matrix,
		LockedCells: LockedCells(),
	}
	if policy != nil {
		t := policy.UpdatedAt
		res.UpdatedAt = &t
		res.UpdatedBy = policy.UpdatedBy
	}
	return res, nil
}

func (s *Service) UpdateMatrix(ctx context.Context, req UpdateMatrixRequest, actor requestctx.Actor, ip string) (MatrixResponse, error) {
	if req.Matrix == nil {
		return MatrixResponse{}, errormap.Validation("ماتریس دسترسی ارسال نشده است", map[string]string{"matrix": "الزامی"})
	}
	normalized, err := NormalizeAndValidateMatrix(req.Matrix)
	if err != nil {
		return MatrixResponse{}, err
	}

	prevMatrix, _, err := s.loadMatrix(ctx)
	if err != nil {
		return MatrixResponse{}, err
	}

	now := time.Now().UTC()
	policy := MatrixPolicy{
		ID:        defaultPolicyID,
		Matrix:    normalized,
		UpdatedAt: now,
		UpdatedBy: actor.Name,
	}
	if err := s.repo.SaveMatrixPolicy(ctx, policy); err != nil {
		return MatrixResponse{}, err
	}

	changed := diffMatrixSummary(prevMatrix, normalized)
	s.recordAccessAudit(ctx, actor, ip, "rbac-matrix", "ماتریس دسترسی نقش‌ها", "به‌روزرسانی ماتریس دسترسی نقش‌ها",
		map[string]any{"changedCells": len(changed)},
		map[string]any{"changes": strings.Join(changed, "، ")},
	)

	return MatrixResponse{
		Roles:       CanonicalRoles,
		Permissions: CanonicalPermissions,
		Matrix:      normalized,
		LockedCells: LockedCells(),
		UpdatedAt:   &now,
		UpdatedBy:   actor.Name,
	}, nil
}

func (s *Service) loadMatrix(ctx context.Context) (MatrixMap, *MatrixPolicy, error) {
	policy, err := s.repo.GetMatrixPolicy(ctx)
	if err != nil {
		return nil, nil, err
	}
	if policy == nil || len(policy.Matrix) == 0 {
		return DefaultMatrix(), nil, nil
	}
	normalized, err := NormalizeAndValidateMatrix(policy.Matrix)
	if err != nil {
		return DefaultMatrix(), policy, nil
	}
	return normalized, policy, nil
}

func (s *Service) recordAccessAudit(ctx context.Context, actor requestctx.Actor, ip, entityID, entityLabel, description string, before, after map[string]any) {
	if s.audit == nil {
		return
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor: audit.Actor{
			ID:       actor.UserID,
			Name:     actor.Name,
			Role:     actor.Role,
			Initials: actor.Initials,
		},
		Action:         "role_change",
		EntityType:     "user_access",
		EntityID:       entityID,
		EntityLabel:    entityLabel,
		Description:    description,
		Severity:       "warning",
		Before:         before,
		After:          after,
		IP:             ip,
		SecurityStatus: "recorded",
		BranchID:       actor.BranchID,
	})
}

func validateUserFields(name, email, phone, role, personnelCode string) map[string]string {
	fields := map[string]string{}
	if name == "" {
		fields["name"] = "نام و نام خانوادگی الزامی است"
	}
	if !IsValidRole(role) {
		fields["role"] = "نقش سازمانی انتخاب‌شده معتبر نیست"
	}
	if personnelCode == "" {
		fields["personnelCode"] = "کد پرسنلی یا شماره نظام پزشکی الزامی است"
	}
	if email != "" && !emailRe.MatchString(email) {
		fields["email"] = "فرمت ایمیل معتبر نیست"
	}
	if phone != "" && len(phone) < 8 {
		fields["phone"] = "شماره تماس معتبر نیست"
	}
	return fields
}

func diffMatrixSummary(prev, next MatrixMap) []string {
	var out []string
	for _, p := range CanonicalPermissions {
		for _, r := range CanonicalRoles {
			a := prev[p.ID][r.ID]
			b := next[p.ID][r.ID]
			if a != b {
				state := "غیرفعال"
				if b {
					state = "فعال"
				}
				out = append(out, p.ID+"."+r.ID+"="+state)
			}
		}
	}
	return out
}
