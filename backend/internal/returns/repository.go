package returns

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const collectionName = "distributor_returns"

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection(collectionName)}
}

func (r *Repository) Insert(ctx context.Context, ret DistributorReturn) error {
	_, err := r.col.InsertOne(ctx, ret)
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*DistributorReturn, error) {
	var ret DistributorReturn
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&ret)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &ret, err
}

func (r *Repository) List(ctx context.Context, status, distributorID string, page, pageSize int) ([]DistributorReturn, int64, error) {
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
	if distributorID != "" {
		filter["distributorId"] = distributorID
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
	items := []DistributorReturn{}
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) CountByStatus(ctx context.Context, status string) (int64, error) {
	return r.col.CountDocuments(ctx, bson.M{"status": status})
}

func (r *Repository) Replace(ctx context.Context, ret DistributorReturn) error {
	_, err := r.col.ReplaceOne(ctx, bson.M{"_id": ret.ID}, ret)
	return err
}

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
				"confirmedAt": "",
				"returnNo":    "",
			},
		},
	)
	return err
}
