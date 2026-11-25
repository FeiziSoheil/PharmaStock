package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/pkg/errormap"
	jwtpkg "pharmastock/backend/pkg/jwt"
	"pharmastock/backend/pkg/requestctx"
)

type fakeStore struct {
	users    map[string]*User
	branches map[string]*Branch
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		users:    make(map[string]*User),
		branches: make(map[string]*Branch),
	}
}

func (f *fakeStore) FindUserByUsername(ctx context.Context, username string) (*User, error) {
	for _, u := range f.users {
		if u.Username == username {
			cp := *u
			return &cp, nil
		}
	}
	return nil, nil
}

func (f *fakeStore) FindUserByID(ctx context.Context, id string) (*User, error) {
	u, ok := f.users[id]
	if !ok {
		return nil, nil
	}
	cp := *u
	return &cp, nil
}

func (f *fakeStore) FindBranch(ctx context.Context, id string) (*Branch, error) {
	b, ok := f.branches[id]
	if !ok {
		return nil, nil
	}
	cp := *b
	return &cp, nil
}

func (f *fakeStore) SaveUserAuthState(ctx context.Context, u *User) error {
	f.users[u.ID] = u
	return nil
}

func (f *fakeStore) ClearLockIfExpired(u *User, now time.Time) bool {
	if u.LockUntil != nil && !u.LockUntil.After(now) {
		u.LockUntil = nil
		u.FailedAttempts = 0
		return true
	}
	return false
}

func (f *fakeStore) UpdateProfile(ctx context.Context, id, name, nameNorm, email, phone string, updatedAt time.Time) error {
	u, ok := f.users[id]
	if !ok {
		return nil
	}
	u.Name = name
	u.NameNorm = nameNorm
	u.Email = email
	u.Phone = phone
	u.UpdatedAt = updatedAt
	return nil
}

func (f *fakeStore) UpdatePassword(ctx context.Context, id, passwordHash string, updatedAt time.Time) error {
	u, ok := f.users[id]
	if !ok {
		return nil
	}
	u.PasswordHash = passwordHash
	u.FailedAttempts = 0
	u.LockUntil = nil
	u.UpdatedAt = updatedAt
	return nil
}

type fakeAuditLogger struct {
	events []audit.AppendInput
}

func (a *fakeAuditLogger) Append(ctx context.Context, in audit.AppendInput) (audit.Event, error) {
	a.events = append(a.events, in)
	return audit.Event{ID: "aud-test"}, nil
}

func TestGetMeSuccessAndNotFound(t *testing.T) {
	store := newFakeStore()
	aud := &fakeAuditLogger{}
	jwtMgr := jwtpkg.NewManager("test-secret", time.Hour)
	svc := NewService(store, jwtMgr, aud)

	ctx := context.Background()
	_, err := svc.GetMe(ctx, requestctx.Actor{UserID: "non-existent"})
	if err == nil {
		t.Fatalf("expected not found error")
	}

	store.branches["branch-central"] = &Branch{ID: "branch-central", NameFa: "داروخانه مرکزی", Active: true}
	store.users["user-1"] = &User{
		ID:            "user-1",
		Username:      "dr.rezaei",
		Name:          "دکتر محمدرضا رضایی",
		Email:         "rezaei@pharmastock.ir",
		Phone:         "09121111111",
		PersonnelCode: "MED-1001",
		Role:          "technical_officer",
		BranchID:      "branch-central",
		UnitLabel:     "انبار مرکزی",
		Status:        "active",
	}

	me, err := svc.GetMe(ctx, requestctx.Actor{UserID: "user-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if me.Username != "dr.rezaei" || me.BranchNameFa != "داروخانه مرکزی" {
		t.Fatalf("unexpected me response: %+v", me)
	}
}

func TestUpdateMeValidationAndPersistence(t *testing.T) {
	store := newFakeStore()
	aud := &fakeAuditLogger{}
	jwtMgr := jwtpkg.NewManager("test-secret", time.Hour)
	svc := NewService(store, jwtMgr, aud)

	store.users["user-1"] = &User{
		ID:       "user-1",
		Username: "operator",
		Name:     "اپراتور اول",
		Email:    "op@test.ir",
		Phone:    "09120000000",
		Status:   "active",
		BranchID: "branch-central",
	}

	ctx := context.Background()
	actor := requestctx.Actor{UserID: "user-1", Name: "اپراتور اول", Role: "warehouse_operator", BranchID: "branch-central"}

	// 1. Empty name -> validation error
	_, err := svc.UpdateMe(ctx, actor, UpdateMeRequest{Name: "   "}, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected validation error on empty name")
	}

	// 2. Invalid email -> validation error
	_, err = svc.UpdateMe(ctx, actor, UpdateMeRequest{Name: "نام معتبر", Email: "invalid-email"}, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected validation error on invalid email")
	}

	// 3. Short phone -> validation error
	_, err = svc.UpdateMe(ctx, actor, UpdateMeRequest{Name: "نام معتبر", Phone: "123"}, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected validation error on short phone")
	}

	// 4. Valid update -> updates store & writes audit
	res, err := svc.UpdateMe(ctx, actor, UpdateMeRequest{
		Name:  "  دکتر رضایی جدید  ",
		Email: "new@test.ir",
		Phone: "09129999999",
	}, "127.0.0.1")
	if err != nil {
		t.Fatalf("unexpected update error: %v", err)
	}
	if res.Name != "دکتر رضایی جدید" || res.Email != "new@test.ir" || res.Phone != "09129999999" {
		t.Fatalf("updated response mismatched: %+v", res)
	}
	if len(aud.events) == 0 || aud.events[0].Action != "profile_update" {
		t.Fatalf("expected profile_update audit event, got: %+v", aud.events)
	}
}

func TestChangePasswordValidationAndHashUpdate(t *testing.T) {
	store := newFakeStore()
	aud := &fakeAuditLogger{}
	jwtMgr := jwtpkg.NewManager("test-secret", time.Hour)
	svc := NewService(store, jwtMgr, aud)

	oldHash, _ := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
	store.users["user-1"] = &User{
		ID:           "user-1",
		Username:     "operator",
		Name:         "اپراتور",
		PasswordHash: string(oldHash),
		Status:       "active",
		BranchID:     "branch-central",
	}

	ctx := context.Background()
	actor := requestctx.Actor{UserID: "user-1", Name: "اپراتور", Role: "warehouse_operator", BranchID: "branch-central"}

	// 1. Wrong current password
	_, err := svc.ChangePassword(ctx, actor, ChangePasswordRequest{
		CurrentPassword: "WrongPassword",
		NewPassword:     "NewSecretPass1",
	}, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected error on wrong current password")
	}

	// 2. Short new password
	_, err = svc.ChangePassword(ctx, actor, ChangePasswordRequest{
		CurrentPassword: "Password123",
		NewPassword:     "short",
	}, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected error on short new password")
	}

	// 3. New password identical to current password
	_, err = svc.ChangePassword(ctx, actor, ChangePasswordRequest{
		CurrentPassword: "Password123",
		NewPassword:     "Password123",
	}, "127.0.0.1")
	if err == nil {
		t.Fatalf("expected error on identical new password")
	}

	// 4. Valid password change
	res, err := svc.ChangePassword(ctx, actor, ChangePasswordRequest{
		CurrentPassword: "Password123",
		NewPassword:     "BrandNewPass2026",
	}, "127.0.0.1")
	if err != nil {
		t.Fatalf("unexpected change password error: %v", err)
	}
	if !res.OK {
		t.Fatalf("expected ok true, got %+v", res)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(store.users["user-1"].PasswordHash), []byte("BrandNewPass2026")); err != nil {
		t.Fatalf("password hash was not updated properly: %v", err)
	}
}

func setupEchoAuthTest(svc *Service) *echo.Echo {
	e := echo.New()
	e.HTTPErrorHandler = errormap.HTTPErrorHandler
	h := NewHandler(svc)

	e.GET("/api/v1/auth/me", h.Me)
	e.PATCH("/api/v1/auth/me", h.UpdateMe)
	e.POST("/api/v1/auth/change-password", h.ChangePassword)
	return e
}

func TestHandlerMeAndChangePassword(t *testing.T) {
	store := newFakeStore()
	aud := &fakeAuditLogger{}
	jwtMgr := jwtpkg.NewManager("test-secret", time.Hour)
	svc := NewService(store, jwtMgr, aud)

	hash, _ := bcrypt.GenerateFromPassword([]byte("CurPass123"), bcrypt.DefaultCost)
	store.branches["b-1"] = &Branch{ID: "b-1", NameFa: "شعبه مرکزی", Active: true}
	store.users["u-1"] = &User{
		ID:           "u-1",
		Username:     "testuser",
		Name:         "کاربر آزمایشی",
		PasswordHash: string(hash),
		Role:         "pharmacist",
		BranchID:     "b-1",
		Status:       "active",
	}

	e := setupEchoAuthTest(svc)

	// 1. GET /api/v1/auth/me
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	requestctx.Set(c, requestctx.Actor{UserID: "u-1", Username: "testuser", Name: "کاربر آزمایشی", Role: "pharmacist", BranchID: "b-1"})
	h := NewHandler(svc)
	if err := h.Me(c); err != nil {
		t.Fatalf("handler Me returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// 2. PATCH /api/v1/auth/me
	updateBody, _ := json.Marshal(UpdateMeRequest{Name: "نام ویرایش شده", Email: "edited@test.ir"})
	req2 := httptest.NewRequest(http.MethodPatch, "/api/v1/auth/me", bytes.NewReader(updateBody))
	req2.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec2 := httptest.NewRecorder()
	c2 := e.NewContext(req2, rec2)
	requestctx.Set(c2, requestctx.Actor{UserID: "u-1", Username: "testuser", Name: "کاربر آزمایشی", Role: "pharmacist", BranchID: "b-1"})
	if err := h.UpdateMe(c2); err != nil {
		t.Fatalf("handler UpdateMe returned error: %v", err)
	}
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec2.Code, rec2.Body.String())
	}

	// 3. POST /api/v1/auth/change-password
	changeBody, _ := json.Marshal(ChangePasswordRequest{CurrentPassword: "CurPass123", NewPassword: "NewSecretPassword2026"})
	req3 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password", bytes.NewReader(changeBody))
	req3.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec3 := httptest.NewRecorder()
	c3 := e.NewContext(req3, rec3)
	requestctx.Set(c3, requestctx.Actor{UserID: "u-1", Username: "testuser", Name: "نام ویرایش شده", Role: "pharmacist", BranchID: "b-1"})
	if err := h.ChangePassword(c3); err != nil {
		t.Fatalf("handler ChangePassword returned error: %v", err)
	}
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec3.Code, rec3.Body.String())
	}
}
