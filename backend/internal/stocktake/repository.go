package stocktake

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const collectionName = "stocktake_cycles"

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection(collectionName)}
}

func (r *Repository) Insert(ctx context.Context, c Cycle) error {
	_, err := r.col.InsertOne(ctx, c)
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*Cycle, error) {
	var c Cycle
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&c)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &c, err
}

func (r *Repository) List(ctx context.Context, status string, page, pageSize int) ([]Cycle, int64, error) {
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
	items := []Cycle{}
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Replace(ctx context.Context, c Cycle) error {
	_, err := r.col.ReplaceOne(ctx, bson.M{"_id": c.ID}, c)
	return err
}

func (r *Repository) ReplaceIfActive(ctx context.Context, c Cycle) (bool, error) {
	res, err := r.col.ReplaceOne(ctx, bson.M{"_id": c.ID, "status": StatusActive}, c)
	if err != nil {
		return false, err
	}
	return res.MatchedCount > 0, nil
}

func (r *Repository) ClaimForConfirm(ctx context.Context, id string) (bool, error) {
	now := time.Now().UTC()
	res, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id, "status": StatusActive},
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

func (r *Repository) RevertToActive(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.col.UpdateOne(ctx,
		bson.M{"_id": id},
		bson.M{
			"$set": bson.M{
				"status":    StatusActive,
				"updatedAt": now,
			},
			"$unset": bson.M{
				"confirmedAt":     "",
				"adjustmentDocNo": "",
			},
		},
	)
	return err
}
