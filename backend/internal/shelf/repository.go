package shelf

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository struct {
	bins    *mongo.Collection
	batches *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		bins:    db.Collection("bins"),
		batches: db.Collection("stock_batches"),
	}
}

func (r *Repository) ListBins(ctx context.Context) ([]Bin, error) {
	cur, err := r.bins.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "address", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []Bin
	err = cur.All(ctx, &items)
	return items, err
}

func (r *Repository) GetBin(ctx context.Context, id string) (*Bin, error) {
	var b Bin
	err := r.bins.FindOne(ctx, bson.M{"_id": id}).Decode(&b)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &b, err
}

func (r *Repository) BatchesByBin(ctx context.Context, binID string) ([]StockBatch, error) {
	cur, err := r.batches.Find(ctx, bson.M{"binId": binID}, options.Find().SetSort(bson.D{{Key: "expiry", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []StockBatch
	err = cur.All(ctx, &items)
	return items, err
}

func (r *Repository) AllBatches(ctx context.Context) ([]StockBatch, error) {
	cur, err := r.batches.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []StockBatch
	err = cur.All(ctx, &items)
	return items, err
}

func (r *Repository) GetBatch(ctx context.Context, id string) (*StockBatch, error) {
	var b StockBatch
	err := r.batches.FindOne(ctx, bson.M{"_id": id}).Decode(&b)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &b, err
}

func (r *Repository) UpdateBatchStatus(ctx context.Context, id, status string) error {
	_, err := r.batches.UpdateByID(ctx, id, bson.M{"$set": bson.M{"status": status}})
	return err
}

func (r *Repository) UpdateBatchQuantity(ctx context.Context, id string, quantity int) error {
	set := bson.M{"quantity": quantity}
	if quantity <= 0 {
		set["status"] = "depleted"
	}
	_, err := r.batches.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}

func (r *Repository) SetBatchQuantityAndStatus(ctx context.Context, id string, quantity int, status string) error {
	set := bson.M{"quantity": quantity}
	if status != "" {
		set["status"] = status
	}
	_, err := r.batches.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}

func (r *Repository) InsertBatch(ctx context.Context, b StockBatch) error {
	_, err := r.batches.InsertOne(ctx, b)
	return err
}

func (r *Repository) DeleteBatch(ctx context.Context, id string) error {
	_, err := r.batches.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) UpdateBatch(ctx context.Context, b StockBatch) error {
	_, err := r.batches.ReplaceOne(ctx, bson.M{"_id": b.ID}, b)
	return err
}

func (r *Repository) UpdateBatchLocation(ctx context.Context, id, locationLabel, binID, zone string) error {
	set := bson.M{"locationLabel": locationLabel}
	if binID != "" {
		set["binId"] = binID
	}
	if zone != "" {
		set["zone"] = zone
	}
	_, err := r.batches.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}

func (r *Repository) BatchesByDrug(ctx context.Context, drugID string) ([]StockBatch, error) {
	cur, err := r.batches.Find(ctx, bson.M{"drugId": drugID}, options.Find().SetSort(bson.D{{Key: "expiry", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []StockBatch
	err = cur.All(ctx, &items)
	return items, err
}

// ActiveBatches returns non-depleted batches with positive quantity, ordered by expiry.
func (r *Repository) ActiveBatches(ctx context.Context) ([]StockBatch, error) {
	filter := bson.M{
		"quantity": bson.M{"$gt": 0},
		"status":   bson.M{"$ne": "depleted"},
	}
	cur, err := r.batches.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "expiry", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []StockBatch
	err = cur.All(ctx, &items)
	return items, err
}

// UpdateBatchesStatus updates status on multiple batches in a single MongoDB round-trip.
func (r *Repository) UpdateBatchesStatus(ctx context.Context, ids []string, status string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	res, err := r.batches.UpdateMany(ctx, bson.M{"_id": bson.M{"$in": ids}}, bson.M{"$set": bson.M{"status": status}})
	if err != nil {
		return 0, err
	}
	return res.ModifiedCount, nil
}

// GetBatchesByIDs fetches multiple batches in one query.
func (r *Repository) GetBatchesByIDs(ctx context.Context, ids []string) ([]StockBatch, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	cur, err := r.batches.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []StockBatch
	err = cur.All(ctx, &items)
	return items, err
}
