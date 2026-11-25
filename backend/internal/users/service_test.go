package users

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"pharmastock/backend/internal/audit"
	"pharmastock/backend/pkg/errormap"
	"pharmastock/backend/pkg/pagination"
	"pharmastock/backend/pkg/requestctx"
)

type fakeRepo struct {
	users    map[string]UserRecord
	branches map[string]BranchRecord
	policy   *MatrixPolicy
	audits   []audit.AppendInput
}

func newFakeRepo() *fakeRepo {
	now := time.Now().UTC()
	return &fakeRepo{
		users: map[string]UserRecord{
			"user-admin": {
				ID: "user-admin", Username: "a.hosseini", Name: "مهندس آریا حسینی",
				NameNorm: "مهندس آریا حسینی", PersonnelCode: "ADM-001",
				Role: "super_admin", BranchID: "branch-central", Status: "active",
				CreatedAt: now, UpdatedAt: now,
			},
			"user-tech": {
				ID: "user-tech", Username: "dr.rezaei", Name: "دکتر محمدرضا رضایی",
				NameNorm: "دکتر محمدرضا رضایی", PersonnelCode: "د-۴۸۲۹۱",
				Role: "technical_officer", BranchID: "branch-central", Status: "active",
				CreatedAt: now, UpdatedAt: now,
			},
		},
		branches: map[string]BranchRecord{
			"branch-central": {ID: "branch-central", NameFa: "داروخانه مرکزی", Active: true},
			"branch-cold":    {ID: "branch-cold", NameFa: "انبار زنجیره سرد", Active: true},
		},
	}
}

func (f *fakeRepo) ListUsers(_ context.Context, fl ListFilter) ([]UserRecord, int64, error) {
	var out []UserRecord
	for _, u := range f.users {
		if fl.Role != "" && u.Role != fl.Role {
			continue
		}
		if fl.Status == "active" && !u.IsActive() {
			continue
		}
		if fl.Status == "inactive" && u.IsActive() {
			continue
		}
		if fl.Search != "" && !strings.Contains(u.Name, fl.Search) && !strings.Contains(u.Username, fl.Search) {
			continue
		}
		out = append(out, u)
	}
	return out, int64(len(out)), nil
}

func (f *fakeRepo) CountKPIs(_ context.Context) (int64, int64, int64, error) {
	var tot, act, tech int64
	for _, u := range f.users {
		tot++
		if u.IsActive() {
			act++
			if IsTechnicalOfficerRole(u.Role) {
				tech++
			}
		}
	}
	return tot, act, tech, nil
}

func (f *fakeRepo) CountActiveSuperAdmins(_ context.Context, excludeID string) (int64, error) {
	var n int64
	for _, u := range f.users {
		if u.ID != excludeID && u.Role == "super_admin" && u.IsActive() {
			n++
		}
	}
	return n, nil
}

func (f *fakeRepo) FindUserByID(_ context.Context, id string) (*UserRecord, error) {
	u, ok := f.users[id]
	if !ok {
		return nil, nil
	}
	cp := u
	return &cp, nil
}

func (f *fakeRepo) FindUserByUsername(_ context.Context, username string) (*UserRecord, error) {
	for _, u := range f.users {
		if u.Username == username {
			cp := u
			return &cp, nil
		}
	}
	return nil, nil
}

func (f *fakeRepo) InsertUser(_ context.Context, u UserRecord) error {
	f.users[u.ID] = u
	return nil
}

func (f *fakeRepo) UpdateUser(_ context.Context, u UserRecord) error {
	f.users[u.ID] = u
	return nil
}

func (f *fakeRepo) ListBranches(_ context.Context) ([]BranchRecord, error) {
	out := make([]BranchRecord, 0, len(f.branches))
	for _, b := range f.branches {
		out = append(out, b)
	}
	return out, nil
}

func (f *fakeRepo) FindBranch(_ context.Context, id string) (*BranchRecord, error) {
	b, ok := f.branches[id]
	if !ok {
		return nil, nil
	}
	return &b, nil
}

func (f *fakeRepo) GetMatrixPolicy(_ context.Context) (*MatrixPolicy, error) {
	if f.policy == nil {
		return nil, nil
	}
	cp := *f.policy
	return &cp, nil
}

func (f *fakeRepo) SaveMatrixPolicy(_ context.Context, p MatrixPolicy) error {
	cp := p
	f.policy = &cp
	return nil
}

func (f *fakeRepo) LastAccessAuditTime(_ context.Context) (*time.Time, error) {
	return nil, nil
}

type fakeAudit struct {
	events []audit.AppendInput
}

func (a *fakeAudit) Append(_ context.Context, in audit.AppendInput) (audit.Event, error) {
	a.events = append(a.events, in)
	return audit.Event{ID: "ev-1", Timestamp: time.Now().UTC()}, nil
}

func assertAppErr(t *testing.T, err error, wantStatus int, wantCode string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error status=%d code=%s, got nil", wantStatus, wantCode)
	}
	var app *errormap.AppError
	if !errors.As(err, &app) {
		t.Fatalf("expected *errormap.AppError, got %T: %v", err, err)
	}
	if app.HTTPStatus != wantStatus || app.Code != wantCode {
		t.Fatalf("got status=%d code=%s (%s), want status=%d code=%s", app.HTTPStatus, app.Code, app.Message, wantStatus, wantCode)
	}
}

func TestCreateUser_SuccessAndValidation(t *testing.T) {
	repo := newFakeRepo()
	aud := &fakeAudit{}
	svc := NewService(repo, aud)
	actor := requestctx.Actor{UserID: "user-admin", Name: "مدیر", Role: "super_admin"}

	created, err := svc.Create(context.Background(), CreateUserRequest{
		Username:      "s.ansari",
		Name:          "دکتر سارا انصاری",
		Email:         "s.ansari@pharmastock.ir",
		Phone:         "09121112233",
		PersonnelCode: "د-۹۹۱۲۳",
		Role:          "technical_officer",
		BranchID:      "branch-central",
		UnitLabel:     "داروخانه مرکزی",
		Password:      "SecretPass123",
	}, actor, "127.0.0.1")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if created.Username != "s.ansari" || !created.Active {
		t.Fatalf("unexpected user dto: %#v", created)
	}
	stored := repo.users[created.ID]
	if stored.PasswordHash == "" || stored.PasswordHash == "SecretPass123" {
		t.Fatal("password must be bcrypt hashed")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("SecretPass123")); err != nil {
		t.Fatalf("bcrypt compare failed: %v", err)
	}
	if len(aud.events) != 1 || aud.events[0].Action != "role_change" {
		t.Fatalf("expected role_change audit event, got %#v", aud.events)
	}

	// Duplicate username conflict
	_, err = svc.Create(context.Background(), CreateUserRequest{
		Username:      "s.ansari",
		Name:          "دوم",
		PersonnelCode: "EMP-9",
		Role:          "warehouse_lead",
		BranchID:      "branch-central",
		Password:      "SecretPass123",
	}, actor, "127.0.0.1")
	assertAppErr(t, err, 409, "conflict")

	// Table-driven invalid inputs
	badCases := []struct {
		name string
		req  CreateUserRequest
	}{
		{"short_password", CreateUserRequest{Username: "u111", Name: "علی", PersonnelCode: "E-1", Role: "warehouse_lead", Password: "123"}},
		{"bad_username", CreateUserRequest{Username: "اب", Name: "علی", PersonnelCode: "E-1", Role: "warehouse_lead", Password: "Password123"}},
		{"bad_role", CreateUserRequest{Username: "valid1", Name: "علی", PersonnelCode: "E-1", Role: "root", Password: "Password123"}},
		{"missing_personnel", CreateUserRequest{Username: "valid2", Name: "علی", PersonnelCode: "", Role: "warehouse_lead", Password: "Password123"}},
	}
	for _, tc := range badCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.Create(context.Background(), tc.req, actor, "127.0.0.1")
			assertAppErr(t, err, 422, "validation_error")
		})
	}
}

func TestMatrixUpdate_EnforcesSeparationOfDuties(t *testing.T) {
	repo := newFakeRepo()
	aud := &fakeAudit{}
	svc := NewService(repo, aud)
	actor := requestctx.Actor{UserID: "user-admin", Name: "مدیر", Role: "super_admin"}

	// Allowed toggle: grant catalog.create_price to warehouse_lead
	m := DefaultMatrix()
	m["catalog.create_price"]["warehouse_lead"] = true
	res, err := svc.UpdateMatrix(context.Background(), UpdateMatrixRequest{Matrix: m}, actor, "10.0.0.1")
	if err != nil {
		t.Fatalf("valid matrix update failed: %v", err)
	}
	if !res.Matrix["catalog.create_price"]["warehouse_lead"] {
		t.Fatal("expected updated permission to persist")
	}

	// Forbidden: grant controlled substance approval to super_admin
	bad1 := DefaultMatrix()
	bad1["outbound.controlled_approval"]["super_admin"] = true
	_, err = svc.UpdateMatrix(context.Background(), UpdateMatrixRequest{Matrix: bad1}, actor, "10.0.0.1")
	assertAppErr(t, err, 422, "validation_error")

	// Forbidden: revoke controlled substance approval from technical_officer
	bad2 := DefaultMatrix()
	bad2["outbound.controlled_approval"]["technical_officer"] = false
	_, err = svc.UpdateMatrix(context.Background(), UpdateMatrixRequest{Matrix: bad2}, actor, "10.0.0.1")
	assertAppErr(t, err, 422, "validation_error")

	// Forbidden: revoke manage_users from super_admin
	bad3 := DefaultMatrix()
	bad3["security.manage_users"]["super_admin"] = false
	_, err = svc.UpdateMatrix(context.Background(), UpdateMatrixRequest{Matrix: bad3}, actor, "10.0.0.1")
	assertAppErr(t, err, 422, "validation_error")
}

func TestStatusGuardsAndCustomPermissions(t *testing.T) {
	repo := newFakeRepo()
	aud := &fakeAudit{}
	svc := NewService(repo, aud)
	adminActor := requestctx.Actor{UserID: "user-admin", Name: "مدیر", Role: "super_admin"}

	// Cannot deactivate self
	_, err := svc.UpdateStatus(context.Background(), "user-admin", UpdateStatusRequest{Active: false}, adminActor, "127.0.0.1")
	assertAppErr(t, err, 422, "validation_error")

	// Cannot deactivate last super_admin even by another actor
	techActor := requestctx.Actor{UserID: "user-tech", Name: "مسئول فنی", Role: "technical_officer"}
	_, err = svc.UpdateStatus(context.Background(), "user-admin", UpdateStatusRequest{Active: false}, techActor, "127.0.0.1")
	assertAppErr(t, err, 422, "validation_error")

	// Cannot grant controlled approval override to super_admin
	yes := true
	_, err = svc.UpdateUserPermissions(context.Background(), "user-admin", UpdateUserPermissionsRequest{
		Overrides: map[string]*bool{"outbound.controlled_approval": &yes},
	}, adminActor, "127.0.0.1")
	assertAppErr(t, err, 422, "validation_error")

	// Valid override on non-locked cell
	no := false
	detail, err := svc.UpdateUserPermissions(context.Background(), "user-tech", UpdateUserPermissionsRequest{
		Overrides: map[string]*bool{"inbound.return_distributor": &no},
	}, adminActor, "127.0.0.1")
	if err != nil {
		t.Fatalf("valid override failed: %v", err)
	}
	if detail.EffectivePermissions["inbound.return_distributor"] {
		t.Fatal("expected override to disable inbound.return_distributor")
	}

	// List returns KPIs cleanly
	list, err := svc.List(context.Background(), "", "", "", "", pagination.Params{Page: 1, PageSize: 25})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if list.KPIs.TotalUsers != 2 || list.KPIs.TechnicalOfficers != 1 {
		t.Fatalf("unexpected KPIs: %#v", list.KPIs)
	}
}
