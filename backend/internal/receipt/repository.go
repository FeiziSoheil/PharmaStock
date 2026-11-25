package receipt

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const collectionName = "invoice_receipts"

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection(collectionName)}
}

func (r *Repository) Insert(ctx context.Context, rec Receipt) error {
	_, err := r.col.InsertOne(ctx, rec)
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*Receipt, error) {
	var rec Receipt
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &rec, err
}

func (r *Repository) List(ctx context.Context, status string, page, pageSize int) ([]Receipt, int64, error) {
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
	items := []Receipt{}
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Replace(ctx context.Context, rec Receipt) error {
	_, err := r.col.ReplaceOne(ctx, bson.M{"_id": rec.ID}, rec)
	return err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.col.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

// ClaimDraft moves a draft to confirmed only when status is still draft.
// A false result means the receipt was already claimed or is no longer a draft.
func (r *Repository) ClaimDraft(ctx context.Context, id string) (bool, error) {
	now := time.Now().UTC()
	res, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id, "status": StatusDraft},
		bson.M{"$set": bson.M{
			"status":      StatusConfirmed,
			"confirmedAt": now,
			"updatedAt":   now,
		}},
	)
	if err != nil {
		return false, err
	}
	return res.MatchedCount > 0, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id, status string) error {
	now := time.Now().UTC()
	set := bson.M{
		"status":    status,
		"updatedAt": now,
	}
	if status == StatusConfirmed {
		set["confirmedAt"] = now
	}
	_, err := r.col.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}
