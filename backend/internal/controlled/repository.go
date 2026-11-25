package controlled

import (
	"context"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"pharmastock/backend/pkg/validator"
)

const ledgerSequenceKey = "controlled_ledger_seq"

type Repository struct {
	col      *mongo.Collection
	counters *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		col:      db.Collection("controlled_ledger_entries"),
		counters: db.Collection("counters"),
	}
}

type ListFilter struct {
	DrugID   string
	TxType   string
	Search   string
	From     *time.Time
	To       *time.Time
	SortBy   string
	SortDir  string
	Page     int
	PageSize int
}

type AggregatedStats struct {
	MonthInflow             int
	MonthInflowShipments    int
	MonthOutflow            int
	ActivePrescriptionCount int
	WasteDestroyedCount     int
	TotalEntries            int64
	LastTimestamp           *time.Time
}

func (r *Repository) NextSeq(ctx context.Context) (int64, error) {
	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)
	var doc struct {
		Seq int64 `bson:"seq"`
	}
	err := r.counters.FindOneAndUpdate(
		ctx,
		bson.M{"_id": ledgerSequenceKey},
		bson.M{"$inc": bson.M{"seq": int64(1)}},
		opts,
	).Decode(&doc)
	if err != nil {
		return 0, err
	}
	return doc.Seq, nil
}

func (r *Repository) Insert(ctx context.Context, e Entry) error {
	_, err := r.col.InsertOne(ctx, e)
	return err
}

func (r *Repository) List(ctx context.Context, f ListFilter) ([]Entry, int64, error) {
	filter := buildFilter(f)
	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	sortKey := resolveSortField(f.SortBy)
	dir := -1
	if f.SortDir == "asc" {
		dir = 1
	}
	sortDoc := bson.D{{Key: sortKey, Value: dir}, {Key: "seqNo", Value: dir}}
	if sortKey == "seqNo" {
		sortDoc = bson.D{{Key: "seqNo", Value: dir}}
	}
	opts := options.Find().
		SetSort(sortDoc).
		SetSkip(int64((f.Page - 1) * f.PageSize)).
		SetLimit(int64(f.PageSize))
	cur, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)
	var items []Entry
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) AggregateStats(ctx context.Context, since time.Time) (AggregatedStats, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{
			"_id":          nil,
			"totalEntries": bson.M{"$sum": 1},
			"lastTs":       bson.M{"$max": "$timestamp"},
			"monthInflow": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$and": bson.A{
						bson.M{"$gte": bson.A{"$timestamp", since}},
						bson.M{"$eq": bson.A{"$txType", TxInDistributor}},
					}},
					"$qtyIn",
					0,
				},
			}},
			"monthInflowShipments": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$and": bson.A{
						bson.M{"$gte": bson.A{"$timestamp", since}},
						bson.M{"$eq": bson.A{"$txType", TxInDistributor}},
					}},
					1,
					0,
				},
			}},
			"monthOutflow": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$and": bson.A{
						bson.M{"$gte": bson.A{"$timestamp", since}},
						bson.M{"$eq": bson.A{"$txType", TxOutPrescription}},
					}},
					"$qtyOut",
					0,
				},
			}},
			"activePrescriptionCount": bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$and": bson.A{
						bson.M{"$gte": bson.A{"$timestamp", since}},
						bson.M{"$eq": bson.A{"$txType", TxOutPrescription}},
					}},
					1,
					0,
				},
			}},
			"wasteDestroyedCount": bson.M{"$sum": "$ampouleWasteCount"},
		}}},
	}
	cur, err := r.col.Aggregate(ctx, pipeline)
	if err != nil {
		return AggregatedStats{}, err
	}
	defer cur.Close(ctx)
	var rows []struct {
		TotalEntries            int64      `bson:"totalEntries"`
		LastTs                  *time.Time `bson:"lastTs"`
		MonthInflow             int        `bson:"monthInflow"`
		MonthInflowShipments    int        `bson:"monthInflowShipments"`
		MonthOutflow            int        `bson:"monthOutflow"`
		ActivePrescriptionCount int        `bson:"activePrescriptionCount"`
		WasteDestroyedCount     int        `bson:"wasteDestroyedCount"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return AggregatedStats{}, err
	}
	if len(rows) == 0 {
		return AggregatedStats{}, nil
	}
	row := rows[0]
	return AggregatedStats{
		MonthInflow:             row.MonthInflow,
		MonthInflowShipments:    row.MonthInflowShipments,
		MonthOutflow:            row.MonthOutflow,
		ActivePrescriptionCount: row.ActivePrescriptionCount,
		WasteDestroyedCount:     row.WasteDestroyedCount,
		TotalEntries:            row.TotalEntries,
		LastTimestamp:           row.LastTs,
	}, nil
}

func buildFilter(f ListFilter) bson.M {
	filter := bson.M{}
	if f.DrugID != "" {
		filter["drugId"] = f.DrugID
	}
	if f.TxType != "" {
		filter["txType"] = f.TxType
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
	if norm := validator.NormalizeFa(f.Search); norm != "" {
		filter["searchNorm"] = bson.M{"$regex": regexp.QuoteMeta(norm), "$options": "i"}
	}
	return filter
}

func resolveSortField(raw string) string {
	switch raw {
	case "seqNo", "timestamp", "qtyIn", "qtyOut", "balanceAfter":
		return raw
	default:
		return "timestamp"
	}
}
