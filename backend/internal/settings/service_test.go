package settings

import (
	"context"
	"testing"

	"pharmastock/backend/internal/audit"
)

type mockRepo struct {
	data *Settings
}

func (m *mockRepo) Get(ctx context.Context) (*Settings, error) {
	return m.data, nil
}

func (m *mockRepo) Upsert(ctx context.Context, s *Settings) error {
	m.data = s
	return nil
}

type mockAudit struct {
	lastEvent audit.AppendInput
}

func (m *mockAudit) Append(ctx context.Context, in audit.AppendInput) (audit.Event, error) {
	m.lastEvent = in
	return audit.Event{ID: "audit-1"}, nil
}

func TestSettingsService_DefaultFallback(t *testing.T) {
	repo := &mockRepo{data: nil}
	svc := NewService(repo, nil)

	s, err := svc.GetSettings(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.PharmacyIdentity.NameFa != "داروخانه دکتر حسینی" {
		t.Errorf("expected default name, got %s", s.PharmacyIdentity.NameFa)
	}
	if s.InventoryRules.CriticalExpiryDays != 30 {
		t.Errorf("expected 30 critical days, got %d", s.InventoryRules.CriticalExpiryDays)
	}
}

func TestSettingsService_UpdateAndValidation(t *testing.T) {
	repo := &mockRepo{data: nil}
	aud := &mockAudit{}
	svc := NewService(repo, aud)

	// Invalid request (empty name)
	badReq := UpdateSettingsRequest{
		PharmacyIdentity: PharmacyIdentity{
			NameFa: "",
		},
	}
	_, err := svc.UpdateSettings(context.Background(), badReq, audit.Actor{ID: "admin", Name: "مدیر"})
	if err == nil {
		t.Fatalf("expected validation error for empty name, got nil")
	}

	// Valid request
	valid := DefaultSettings()
	valid.PharmacyIdentity.NameFa = "داروخانه مرکزی رازی"
	valid.InventoryRules.CriticalExpiryDays = 45
	valid.InventoryRules.WarningExpiryDays = 95
	valid.InventoryRules.WatchExpiryDays = 190

	req := UpdateSettingsRequest{
		PharmacyIdentity: valid.PharmacyIdentity,
		InventoryRules:   valid.InventoryRules,
		TTACIntegration:  valid.TTACIntegration,
		SecurityConfig:   valid.SecurityConfig,
	}

	updated, err := svc.UpdateSettings(context.Background(), req, audit.Actor{ID: "dr_user", Name: "دکتر رازی"})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.PharmacyIdentity.NameFa != "داروخانه مرکزی رازی" {
		t.Errorf("expected updated name, got %s", updated.PharmacyIdentity.NameFa)
	}
	if updated.UpdatedBy != "dr_user" {
		t.Errorf("expected actor dr_user, got %s", updated.UpdatedBy)
	}
	if aud.lastEvent.Action != "settings_update" {
		t.Errorf("expected audit action settings_update, got %s", aud.lastEvent.Action)
	}
}

func TestSettingsService_TestTTAC(t *testing.T) {
	repo := &mockRepo{data: nil}
	svc := NewService(repo, nil)

	res, err := svc.TestTTAC(context.Background())
	if err != nil {
		t.Fatalf("test ttac failed: %v", err)
	}
	if !res.Success {
		t.Errorf("expected test success")
	}
	if res.BaseURL == "" {
		t.Errorf("expected base URL")
	}
}
