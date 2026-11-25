package reconciliation

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection("purchase_reconciliations")}
}

func (r *Repository) Insert(ctx context.Context, rec Reconciliation) error {
	_, err := r.col.InsertOne(ctx, rec)
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*Reconciliation, error) {
	var rec Reconciliation
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &rec, err
}

func (r *Repository) List(ctx context.Context, status string, page, pageSize int) ([]Reconciliation, int64, error) {
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "updatedAt", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))
	cur, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)
	var items []Reconciliation
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Replace(ctx context.Context, rec Reconciliation) error {
	_, err := r.col.ReplaceOne(ctx, bson.M{"_id": rec.ID}, rec)
	return err
}

// ClaimPending atomically transitions a non-confirmed reconciliation to confirming to prevent double-confirm races.
func (r *Repository) ClaimPending(ctx context.Context, id string) (bool, error) {
	res, err := r.col.UpdateOne(
		ctx,
		bson.M{"_id": id, "status": bson.M{"$in": []string{StatusUploaded, StatusMapped}}},
		bson.M{"$set": bson.M{"status": "confirming"}},
	)
	if err != nil {
		return false, err
	}
	return res.MatchedCount == 1, nil
}
