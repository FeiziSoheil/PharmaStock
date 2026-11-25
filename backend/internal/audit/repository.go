package audit

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection("audit_events")}
}

// Append inserts an audit event. There is intentionally no Update or Delete.
func (r *Repository) Append(ctx context.Context, in AppendInput) (Event, error) {
	sev := in.Severity
	if sev == "" {
		sev = "info"
	}
	src := in.Source
	if src == "" {
		src = "api"
	}
	sec := in.SecurityStatus
	if sec == "" {
		sec = "ok"
	}
	ev := Event{
		ID:                    uuid.NewString(),
		Timestamp:             time.Now().UTC(),
		Actor:                 in.Actor,
		Action:                in.Action,
		EntityType:            in.EntityType,
		EntityID:              in.EntityID,
		EntityLabel:           in.EntityLabel,
		Description:           in.Description,
		Severity:              sev,
		Source:                src,
		Before:                in.Before,
		After:                 in.After,
		IP:                    in.IP,
		Terminal:              in.Terminal,
		SecurityStatus:        sec,
		IsControlledSubstance: in.IsControlledSubstance,
		BranchID:              in.BranchID,
	}
	_, err := r.col.InsertOne(ctx, ev)
	return ev, err
}

type ListFilter struct {
	ActorID    string
	Role       string
	Action     string
	EntityType string
	Severity   string
	Search     string
	From       *time.Time
	To         *time.Time
	SortBy     string
	SortDir    string
	Page       int
	PageSize   int
}

func (r *Repository) List(ctx context.Context, f ListFilter) ([]Event, int64, error) {
	filter := bson.M{}
	if f.ActorID != "" {
		filter["actor.id"] = f.ActorID
	}
	if f.Role != "" {
		filter["actor.role"] = f.Role
	}
	if f.Action != "" {
		filter["action"] = f.Action
	}
	if f.EntityType != "" {
		filter["entityType"] = f.EntityType
	}
	if f.Severity != "" {
		filter["severity"] = f.Severity
	}
	if f.From != nil || f.To != nil {
		ts := bson.M{}
		if f.From != nil {
			ts["$gte"] = *f.From
		}
		if f.To != nil {
			ts["$lte"] = *f.To
		}
		filter["timestamp"] = ts
	}
	if f.Search != "" {
		filter["$or"] = []bson.M{
			{"description": bson.M{"$regex": f.Search, "$options": "i"}},
			{"entityLabel": bson.M{"$regex": f.Search, "$options": "i"}},
			{"entityId": bson.M{"$regex": f.Search, "$options": "i"}},
		}
	}

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	sortKey := "timestamp"
	if f.SortBy != "" {
		sortKey = f.SortBy
	}
	dir := -1
	if f.SortDir == "asc" {
		dir = 1
	}
	opts := options.Find().
		SetSort(bson.D{{Key: sortKey, Value: dir}}).
		SetSkip(int64((f.Page - 1) * f.PageSize)).
		SetLimit(int64(f.PageSize))
	cur, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)
	var items []Event
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) DistinctActors(ctx context.Context) ([]Actor, error) {
	cur, err := r.col.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":      "$actor.id",
			"name":     bson.M{"$first": "$actor.name"},
			"role":     bson.M{"$first": "$actor.role"},
			"initials": bson.M{"$first": "$actor.initials"},
		}}},
		{{Key: "$sort", Value: bson.M{"name": 1}}},
	})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var rows []struct {
		ID       string `bson:"_id"`
		Name     string `bson:"name"`
		Role     string `bson:"role"`
		Initials string `bson:"initials"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	out := make([]Actor, 0, len(rows))
	for _, row := range rows {
		out = append(out, Actor{ID: row.ID, Name: row.Name, Role: row.Role, Initials: row.Initials})
	}
	return out, nil
}

// LatestTimestamp returns the most recent audit event timestamp using the descending timestamp index.
func (r *Repository) LatestTimestamp(ctx context.Context) (*time.Time, error) {
	opts := options.FindOne().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetProjection(bson.M{"timestamp": 1})
	var row struct {
		Timestamp time.Time `bson:"timestamp"`
	}
	err := r.col.FindOne(ctx, bson.M{}, opts).Decode(&row)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row.Timestamp, nil
}
