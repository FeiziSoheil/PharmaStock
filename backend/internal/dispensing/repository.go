package dispensing

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const collectionName = "dispense_orders"

type Repository struct {
	col *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{col: db.Collection(collectionName)}
}

func (r *Repository) Insert(ctx context.Context, order Order) error {
	_, err := r.col.InsertOne(ctx, order)
	return err
}

func (r *Repository) Get(ctx context.Context, id string) (*Order, error) {
	var order Order
	err := r.col.FindOne(ctx, bson.M{"_id": id}).Decode(&order)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &order, err
}

func (r *Repository) List(ctx context.Context, status string, page, pageSize int) ([]Order, int64, error) {
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
	items := []Order{}
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Replace(ctx context.Context, order Order) error {
	_, err := r.col.ReplaceOne(ctx, bson.M{"_id": order.ID}, order)
	return err
}
