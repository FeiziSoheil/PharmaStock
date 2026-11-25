package audit

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"pharmastock/backend/pkg/pagination"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Append(ctx context.Context, in AppendInput) (Event, error) {
	return s.repo.Append(ctx, in)
}

func (s *Service) LatestTimestamp(ctx context.Context) (*time.Time, error) {
	return s.repo.LatestTimestamp(ctx)
}

type ListQuery struct {
	ActorID    string
	Role       string
	Action     string
	EntityType string
	Severity   string
	Search     string
	Page       int
	PageSize   int
	SortBy     string
	SortDir    string
}

type KPIs struct {
	TotalEvents   int64 `json:"totalEvents"`
	FailureLogins int64 `json:"failureLogins"`
	Controlled    int64 `json:"controlled"`
}

type ListResponse struct {
	pagination.Result[Event]
	KPIs   KPIs    `json:"kpis"`
	Actors []Actor `json:"actors"`
}

func (s *Service) List(ctx context.Context, q ListQuery) (ListResponse, error) {
	items, total, err := s.repo.List(ctx, ListFilter{
		ActorID: q.ActorID, Role: q.Role, Action: q.Action, EntityType: q.EntityType,
		Severity: q.Severity, Search: q.Search, Page: q.Page, PageSize: q.PageSize,
		SortBy: q.SortBy, SortDir: q.SortDir,
	})
	if err != nil {
		return ListResponse{}, err
	}
	actors, err := s.repo.DistinctActors(ctx)
	if err != nil {
		return ListResponse{}, err
	}
	var fail, controlled int64
	for _, ev := range items {
		if ev.Action == "login_failure" || ev.Action == "login_lock" {
			fail++
		}
		if ev.IsControlledSubstance {
			controlled++
		}
	}
	res := pagination.Wrap(items, int(total), q.Page, q.PageSize)
	return ListResponse{
		Result: res,
		KPIs:   KPIs{TotalEvents: total, FailureLogins: fail, Controlled: controlled},
		Actors: actors,
	}, nil
}

func (s *Service) Export(ctx context.Context, q ListQuery, format string) ([]byte, string, error) {
	q.Page = 1
	q.PageSize = 5000
	list, err := s.List(ctx, q)
	if err != nil {
		return nil, "", err
	}
	switch format {
	case "json":
		b, err := json.MarshalIndent(list.Items, "", "  ")
		return b, "application/json", err
	default:
		var buf bytes.Buffer
		w := csv.NewWriter(&buf)
		_ = w.Write([]string{"id", "timestamp", "actor", "action", "entityType", "entityId", "description", "severity"})
		for _, ev := range list.Items {
			_ = w.Write([]string{
				ev.ID,
				ev.Timestamp.Format(time.RFC3339),
				ev.Actor.Name,
				ev.Action,
				ev.EntityType,
				ev.EntityID,
				ev.Description,
				ev.Severity,
			})
		}
		w.Flush()
		return buf.Bytes(), "text/csv", w.Error()
	}
}

func (s *Service) ExportFilename(format string) string {
	ts := time.Now().UTC().Format("20060102-150405")
	if format == "json" {
		return fmt.Sprintf("audit-%s.json", ts)
	}
	return fmt.Sprintf("audit-%s.csv", ts)
}
