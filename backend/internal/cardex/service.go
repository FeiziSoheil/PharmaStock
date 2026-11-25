package cardex

import (
	"context"
	"time"

	"github.com/google/uuid"

	"pharmastock/backend/pkg/pagination"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

type AppendInput struct {
	DrugID     string
	Type       string
	BatchNo    string
	QtyIn      int
	QtyOut     int
	ActorName  string
	ShiftLabel string
	Note       string
	At         time.Time
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) Append(ctx context.Context, in AppendInput) (Movement, error) {
	at := in.At
	if at.IsZero() {
		at = time.Now().UTC()
	}
	m := Movement{
		ID: uuid.NewString(), DrugID: in.DrugID, Timestamp: at, Type: in.Type,
		BatchNo: in.BatchNo, QtyIn: in.QtyIn, QtyOut: in.QtyOut,
		ActorName: in.ActorName, ShiftLabel: in.ShiftLabel, Note: in.Note,
	}
	if err := s.repo.Append(ctx, m); err != nil {
		return Movement{}, err
	}
	return m, nil
}

func (s *Service) List(ctx context.Context, drugID string, p pagination.Params) (pagination.Result[MovementDTO], error) {
	items, total, err := s.repo.ListByDrug(ctx, drugID, p.Page, p.PageSize)
	if err != nil {
		return pagination.Result[MovementDTO]{}, err
	}
	out := make([]MovementDTO, 0, len(items))
	for _, m := range items {
		out = append(out, ToDTO(m))
	}
	return pagination.Wrap(out, int(total), p.Page, p.PageSize), nil
}
