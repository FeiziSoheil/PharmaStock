package transfer

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const collectionName = "internal_transfers"

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection(collectionName)}
}

func (r *Repository) Insert(ctx context.Context, t Transfer) error {
	_, err := r.col.InsertOne(ctx, t)
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*Transfer, error) {
	var t Transfer
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &t, err
}

func (r *Repository) List(ctx context.Context, status string, page, pageSize int) ([]Transfer, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 25
	}
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
	items := []Transfer{}
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Replace(ctx context.Context, t Transfer) error {
	_, err := r.col.ReplaceOne(ctx, bson.M{"_id": t.ID}, t)
	return err
}

// ReplaceIfDraft replaces the document only while it is still a draft.
func (r *Repository) ReplaceIfDraft(ctx context.Context, t Transfer) (bool, error) {
	res, err := r.col.ReplaceOne(ctx, bson.M{"_id": t.ID, "status": StatusDraft}, t)
	if err != nil {
		return false, err
	}
	return res.MatchedCount > 0, nil
}

// ClaimForConfirm atomically reserves a draft for confirm (status confirming) without finalizing it.
func (r *Repository) ClaimForConfirm(ctx context.Context, id string) (bool, error) {
	now := time.Now().UTC()
	res, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id, "status": StatusDraft},
		bson.M{"$set": bson.M{
			"status":    StatusConfirming,
			"updatedAt": now,
		}},
	)
	if err != nil {
		return false, err
	}
	return res.MatchedCount > 0, nil
}

// RevertToDraft clears confirm fields and sets status back to draft after a failed confirm.
func (r *Repository) RevertToDraft(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$set": bson.M{
				"status":    StatusDraft,
				"updatedAt": now,
			},
			"$unset": bson.M{
				"confirmedAt":    "",
				"transferNo":     "",
				"resultBatchIds": "",
			},
		},
	)
	return err
}
