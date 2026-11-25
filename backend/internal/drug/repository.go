package drug

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository struct {
	drugs *mongo.Collection
	ttac  *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		drugs: db.Collection("drugs"),
		ttac:  db.Collection("ttac_cache"),
	}
}

type ListFilter struct {
	Search       string
	DosageForm   string
	Category     string
	IsControlled *bool
	SortBy       string
	SortDir      string
	Page         int
	PageSize     int
}

func (r *Repository) List(ctx context.Context, f ListFilter) ([]Drug, int64, error) {
	filter := bson.M{}
	if f.Search != "" {
		filter["$or"] = []bson.M{
			{"nameNorm": bson.M{"$regex": f.Search, "$options": "i"}},
			{"gtin": bson.M{"$regex": f.Search, "$options": "i"}},
			{"genericCode": bson.M{"$regex": f.Search, "$options": "i"}},
			{"brandName": bson.M{"$regex": f.Search, "$options": "i"}},
		}
	}
	if f.DosageForm != "" {
		filter["dosageForm"] = f.DosageForm
	}
	if f.Category != "" {
		filter["category"] = f.Category
	}
	if f.IsControlled != nil {
		filter["isControlled"] = *f.IsControlled
	}
	total, err := r.drugs.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	sortKey := f.SortBy
	if sortKey == "" {
		sortKey = "nameFa"
	}
	dir := 1
	if f.SortDir == "desc" {
		dir = -1
	}
	opts := options.Find().SetSort(bson.D{{Key: sortKey, Value: dir}}).
		SetSkip(int64((f.Page - 1) * f.PageSize)).SetLimit(int64(f.PageSize))
	cur, err := r.drugs.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)
	var items []Drug
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Get(ctx context.Context, id string) (*Drug, error) {
	var d Drug
	err := r.drugs.FindOne(ctx, bson.M{"_id": id}).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &d, err
}

func (r *Repository) Insert(ctx context.Context, d Drug) error {
	_, err := r.drugs.InsertOne(ctx, d)
	return err
}

func (r *Repository) Replace(ctx context.Context, d Drug) error {
	_, err := r.drugs.ReplaceOne(ctx, bson.M{"_id": d.ID}, d)
	return err
}

func (r *Repository) UpdateTotalStock(ctx context.Context, id string, totalStock int) error {
	_, err := r.drugs.UpdateByID(ctx, id, bson.M{"$set": bson.M{"totalStock": totalStock}})
	return err
}

func (r *Repository) FindByGTIN(ctx context.Context, gtin string, excludeID string) (*Drug, error) {
	filter := bson.M{"gtin": gtin}
	if excludeID != "" {
		filter["_id"] = bson.M{"$ne": excludeID}
	}
	var d Drug
	err := r.drugs.FindOne(ctx, filter).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &d, err
}

func (r *Repository) GetTTACCache(ctx context.Context, irc, gtin string) (*TtacCache, error) {
	or := []bson.M{}
	if irc != "" {
		or = append(or, bson.M{"irc": irc})
	}
	if gtin != "" {
		or = append(or, bson.M{"gtin": gtin})
	}
	if len(or) == 0 {
		return nil, nil
	}
	var row TtacCache
	err := r.ttac.FindOne(ctx, bson.M{"$or": or}).Decode(&row)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) UpsertTTACCache(ctx context.Context, row TtacCache) error {
	id := row.ID
	if id == "" {
		id = TTACCacheID(row.IRC, row.GTIN)
	}
	// MongoDB rejects updates that $set the immutable _id field.
	row.ID = ""
	set, err := bson.Marshal(row)
	if err != nil {
		return err
	}
	var doc bson.M
	if err := bson.Unmarshal(set, &doc); err != nil {
		return err
	}
	delete(doc, "_id")
	_, err = r.ttac.UpdateByID(ctx, id, bson.M{"$set": doc}, options.Update().SetUpsert(true))
	return err
}

func (r *Repository) All(ctx context.Context) ([]Drug, error) {
	cur, err := r.drugs.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []Drug
	err = cur.All(ctx, &items)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.drugs.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) UpdateStockSummary(ctx context.Context, id string, totalStock int, nearestExpiry string) error {
	set := bson.M{"totalStock": totalStock}
	if nearestExpiry != "" {
		set["nearestExpiry"] = nearestExpiry
	}
	_, err := r.drugs.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}
