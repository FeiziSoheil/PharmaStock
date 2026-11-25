package auth

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/pkg/errormap"
	jwtpkg "pharmastock/backend/pkg/jwt"
	"pharmastock/backend/pkg/requestctx"
	"pharmastock/backend/pkg/validator"
)

const (
	MaxFailures = 5
	LockSeconds = 60
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type Store interface {
	FindUserByUsername(ctx context.Context, username string) (*User, error)
	FindUserByID(ctx context.Context, id string) (*User, error)
	FindBranch(ctx context.Context, id string) (*Branch, error)
	SaveUserAuthState(ctx context.Context, u *User) error
	ClearLockIfExpired(u *User, now time.Time) bool
	UpdateProfile(ctx context.Context, id, name, nameNorm, email, phone string, updatedAt time.Time) error
	UpdatePassword(ctx context.Context, id, passwordHash string, updatedAt time.Time) error
}

type AuditLogger interface {
	Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)
}

type Service struct {
	repo  Store
	jwt   *jwtpkg.Manager
	audit AuditLogger
}

func NewService(repo Store, jwt *jwtpkg.Manager, auditSvc AuditLogger) *Service {
	return &Service{repo: repo, jwt: jwt, audit: auditSvc}
}

func (s *Service) Login(ctx context.Context, req LoginRequest, ip string) (any, int) {
	now := time.Now().UTC()
	username := req.Username

	user, err := s.repo.FindUserByUsername(ctx, username)
	if err != nil {
		return LoginFailure{OK: false, Code: "network_error", Message: "خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.", CanRetry: boolPtr(true)}, 503
	}
	branch, err := s.repo.FindBranch(ctx, req.BranchID)
	if err != nil {
		return LoginFailure{OK: false, Code: "network_error", Message: "خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.", CanRetry: boolPtr(true)}, 503
	}

	failAudit := func(action, desc string) {
		actor := audit.Actor{ID: "anonymous", Name: username, Role: "unknown", Initials: "؟"}
		if user != nil {
			actor = audit.Actor{ID: user.ID, Name: user.Name, Role: user.Role, Initials: initials(user.Name)}
		}
		if s.audit != nil {
			_, _ = s.audit.Append(ctx, audit.AppendInput{
				Actor: actor, Action: action, EntityType: "user", EntityID: username,
				EntityLabel: username, Description: desc, Severity: "warning", IP: ip,
				BranchID: req.BranchID, SecurityStatus: "alert",
			})
		}
	}

	if user != nil && s.repo.ClearLockIfExpired(user, now) {
		_ = s.repo.SaveUserAuthState(ctx, user)
	}

	if user != nil && user.PermanentlyLocked {
		failAudit("login_lock", "حساب کاربری قفل دائمی است")
		return LoginFailure{OK: false, Code: "account_locked", Message: "حساب کاربری قفل شده است. با پشتیبانی سامانه تماس بگیرید."}, 403
	}

	if user != nil && !user.IsActive() {
		failAudit("login_lock", "حساب کاربری غیرفعال است")
		return LoginFailure{OK: false, Code: "account_locked", Message: "حساب کاربری غیرفعال شده است. با مدیر سامانه تماس بگیرید."}, 403
	}

	if user != nil && user.LockUntil != nil && user.LockUntil.After(now) {
		sec := int(time.Until(*user.LockUntil).Seconds())
		if sec < 1 {
			sec = 1
		}
		failAudit("login_lock", "قفل موقت ورود")
		return LoginFailure{
			OK: false, Code: "temporary_lock",
			Message:           fmt.Sprintf("ورود موقتاً قفل شده است. %d ثانیه دیگر دوباره تلاش کنید.", sec),
			RetryAfterSeconds: &sec,
		}, 429
	}

	invalid := user == nil || branch == nil || !branch.Active
	if !invalid {
		invalid = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil
	}

	if invalid {
		if user != nil {
			user.FailedAttempts++
			if user.FailedAttempts >= MaxFailures {
				until := now.Add(time.Duration(LockSeconds) * time.Second)
				user.LockUntil = &until
				user.FailedAttempts = 0
				_ = s.repo.SaveUserAuthState(ctx, user)
				failAudit("login_lock", "قفل موقت پس از تلاش‌های ناموفق")
				sec := LockSeconds
				return LoginFailure{
					OK: false, Code: "temporary_lock",
					Message:           fmt.Sprintf("ورود موقتاً قفل شده است. %d ثانیه دیگر دوباره تلاش کنید.", sec),
					RetryAfterSeconds: &sec,
				}, 429
			}
			_ = s.repo.SaveUserAuthState(ctx, user)
		}
		failAudit("login_failure", "ورود ناموفق")
		return LoginFailure{OK: false, Code: "invalid_credentials", Message: "نام کاربری یا رمز عبور نادرست است."}, 401
	}

	user.FailedAttempts = 0
	user.LockUntil = nil
	user.LastLoginAt = &now
	user.LastLoginIP = ip
	_ = s.repo.SaveUserAuthState(ctx, user)

	token, err := s.jwt.Issue(jwtpkg.Claims{
		UserID: user.ID, Username: user.Username, Name: user.Name, Role: user.Role, BranchID: branch.ID,
	})
	if err != nil {
		return LoginFailure{OK: false, Code: "network_error", Message: "خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.", CanRetry: boolPtr(true)}, 503
	}

	if s.audit != nil {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor:  audit.Actor{ID: user.ID, Name: user.Name, Role: user.Role, Initials: initials(user.Name)},
			Action: "login_success", EntityType: "user", EntityID: user.ID, EntityLabel: user.Name,
			Description: "ورود موفق", Severity: "info", IP: ip, BranchID: branch.ID,
		})
	}

	return LoginSuccess{
		OK: true, Token: token,
		User:   UserDTO{ID: user.ID, Username: user.Username, Name: user.Name, Role: user.Role},
		Branch: *branch,
	}, 200
}

func (s *Service) GetMe(ctx context.Context, actor requestctx.Actor) (MeResponse, error) {
	u, err := s.repo.FindUserByID(ctx, actor.UserID)
	if err != nil {
		return MeResponse{}, err
	}
	if u == nil {
		return MeResponse{}, errormap.NotFound("کاربر یافت نشد")
	}

	branchNameFa := ""
	if u.BranchID != "" {
		if b, _ := s.repo.FindBranch(ctx, u.BranchID); b != nil {
			branchNameFa = b.NameFa
		}
	}

	return toMeResponse(*u, branchNameFa), nil
}

func (s *Service) UpdateMe(ctx context.Context, actor requestctx.Actor, req UpdateMeRequest, ip string) (MeResponse, error) {
	u, err := s.repo.FindUserByID(ctx, actor.UserID)
	if err != nil {
		return MeResponse{}, err
	}
	if u == nil {
		return MeResponse{}, errormap.NotFound("کاربر یافت نشد")
	}

	name := strings.TrimSpace(req.Name)
	email := strings.TrimSpace(req.Email)
	phone := strings.TrimSpace(req.Phone)

	fields := map[string]string{}
	if name == "" {
		fields["name"] = "نام و نام خانوادگی الزامی است"
	}
	if email != "" && !emailRe.MatchString(email) {
		fields["email"] = "فرمت ایمیل معتبر نیست"
	}
	if phone != "" && len(phone) < 8 {
		fields["phone"] = "شماره تماس معتبر نیست"
	}
	if len(fields) > 0 {
		return MeResponse{}, errormap.Validation("لطفاً اطلاعات ورودی را اصلاح کنید", fields)
	}

	now := time.Now().UTC()
	nameNorm := validator.NormalizeFa(name)

	before := map[string]any{
		"name":  u.Name,
		"email": u.Email,
		"phone": u.Phone,
	}

	if err := s.repo.UpdateProfile(ctx, u.ID, name, nameNorm, email, phone, now); err != nil {
		return MeResponse{}, err
	}

	u.Name = name
	u.NameNorm = nameNorm
	u.Email = email
	u.Phone = phone
	u.UpdatedAt = now

	branchNameFa := ""
	if u.BranchID != "" {
		if b, _ := s.repo.FindBranch(ctx, u.BranchID); b != nil {
			branchNameFa = b.NameFa
		}
	}

	if s.audit != nil {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor: audit.Actor{
				ID:       u.ID,
				Name:     u.Name,
				Role:     u.Role,
				Initials: initials(u.Name),
			},
			Action:      "profile_update",
			EntityType:  "user",
			EntityID:    u.ID,
			EntityLabel: u.Name,
			Description: "ویرایش مشخصات کاربری توسط خود کاربر",
			Severity:    "info",
			Before:      before,
			After: map[string]any{
				"name":  u.Name,
				"email": u.Email,
				"phone": u.Phone,
			},
			IP:       ip,
			BranchID: u.BranchID,
		})
	}

	return toMeResponse(*u, branchNameFa), nil
}

func (s *Service) ChangePassword(ctx context.Context, actor requestctx.Actor, req ChangePasswordRequest, ip string) (ChangePasswordResponse, error) {
	u, err := s.repo.FindUserByID(ctx, actor.UserID)
	if err != nil {
		return ChangePasswordResponse{}, err
	}
	if u == nil {
		return ChangePasswordResponse{}, errormap.NotFound("کاربر یافت نشد")
	}

	fields := map[string]string{}
	if req.CurrentPassword == "" {
		fields["currentPassword"] = "رمز عبور فعلی الزامی است"
	}
	if len(req.NewPassword) < 8 {
		fields["newPassword"] = "رمز عبور جدید باید حداقل ۸ کاراکتر باشد"
	} else if req.NewPassword == req.CurrentPassword {
		fields["newPassword"] = "رمز عبور جدید نمی‌تواند مشابه رمز فعلی باشد"
	}

	if len(fields) > 0 {
		return ChangePasswordResponse{}, errormap.Validation("لطفاً اطلاعات را به‌درستی تکمیل کنید", fields)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return ChangePasswordResponse{}, errormap.Validation("رمز عبور فعلی نادرست است", map[string]string{
			"currentPassword": "رمز عبور فعلی واردشده صحیح نیست",
		})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return ChangePasswordResponse{}, err
	}

	now := time.Now().UTC()
	if err := s.repo.UpdatePassword(ctx, u.ID, string(hash), now); err != nil {
		return ChangePasswordResponse{}, err
	}

	if s.audit != nil {
		_, _ = s.audit.Append(ctx, audit.AppendInput{
			Actor: audit.Actor{
				ID:       u.ID,
				Name:     u.Name,
				Role:     u.Role,
				Initials: initials(u.Name),
			},
			Action:      "password_change",
			EntityType:  "user",
			EntityID:    u.ID,
			EntityLabel: u.Name,
			Description: "تغییر رمز عبور توسط کاربر",
			Severity:    "warning",
			IP:          ip,
			BranchID:    u.BranchID,
		})
	}

	return ChangePasswordResponse{
		OK:      true,
		Message: "رمز عبور با موفقیت تغییر یافت",
	}, nil
}

func toMeResponse(u User, branchNameFa string) MeResponse {
	status := u.Status
	if u.PermanentlyLocked {
		status = "locked"
	} else if status == "" {
		status = "active"
	}

	var created, updated *time.Time
	if !u.CreatedAt.IsZero() {
		t := u.CreatedAt
		created = &t
	}
	if !u.UpdatedAt.IsZero() {
		t := u.UpdatedAt
		updated = &t
	}

	return MeResponse{
		ID:               u.ID,
		Username:         u.Username,
		Name:             u.Name,
		Email:            u.Email,
		Phone:            u.Phone,
		PersonnelCode:    u.PersonnelCode,
		MedicalCouncilNo: u.MedicalCouncilNo,
		Role:             u.Role,
		BranchID:         u.BranchID,
		BranchNameFa:     branchNameFa,
		UnitLabel:        u.UnitLabel,
		Status:           status,
		LastLoginAt:      u.LastLoginAt,
		LastLoginIP:      u.LastLoginIP,
		LastLoginDevice:  u.LastLoginDevice,
		CreatedAt:        created,
		UpdatedAt:        updated,
	}
}

func boolPtr(v bool) *bool { return &v }

func initials(name string) string {
	r := []rune(name)
	if len(r) == 0 {
		return "?"
	}
	if len(r) == 1 {
		return string(r[0])
	}
	return string(r[0]) + string(r[len(r)-1])
}
