package reorder

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"pharmastock/backend/pkg/domain"
)

const settingsDocID = "default"

type Repository struct {
	drafts    *mongo.Collection
	dismissed *mongo.Collection
	settings  *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		drafts:    db.Collection("purchase_drafts"),
		dismissed: db.Collection("reorder_dismissed"),
		settings:  db.Collection("reorder_settings"),
	}
}

func (r *Repository) GetSettings(ctx context.Context) (domain.ReorderFormulaConfig, error) {
	var doc FormulaSettings
	err := r.settings.FindOne(ctx, bson.M{"_id": settingsDocID}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return domain.DefaultReorderFormulaConfig(), nil
	}
	if err != nil {
		return domain.ReorderFormulaConfig{}, err
	}
	if doc.Mode == "" {
		return domain.DefaultReorderFormulaConfig(), nil
	}
	return doc.ReorderFormulaConfig, nil
}

func (r *Repository) SaveSettings(ctx context.Context, cfg domain.ReorderFormulaConfig, actorID string) error {
	doc := FormulaSettings{
		ID:                   settingsDocID,
		ReorderFormulaConfig: cfg,
		UpdatedAt:            time.Now().UTC(),
		UpdatedBy:            actorID,
	}
	_, err := r.settings.ReplaceOne(ctx, bson.M{"_id": settingsDocID}, doc, options.Replace().SetUpsert(true))
	return err
}

func (r *Repository) InsertOrders(ctx context.Context, orders []PurchaseOrder) error {
	if len(orders) == 0 {
		return nil
	}
	docs := make([]any, 0, len(orders))
	for _, o := range orders {
		docs = append(docs, o)
	}
	_, err := r.drafts.InsertMany(ctx, docs)
	return err
}

func (r *Repository) ListOrders(ctx context.Context, status, distributorID string) ([]PurchaseOrder, error) {
	filter := bson.M{}
	if distributorID != "" {
		filter["distributorId"] = distributorID
	}
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cur, err := r.drafts.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	out := make([]PurchaseOrder, 0)
	for cur.Next(ctx) {
		var po PurchaseOrder
		if err := cur.Decode(&po); err != nil {
			return nil, err
		}
		normalizeLegacyOrder(&po)
		if status != "" && po.Status != status {
			continue
		}
		out = append(out, po)
	}
	return out, cur.Err()
}

func (r *Repository) GetOrder(ctx context.Context, id string) (*PurchaseOrder, error) {
	var po PurchaseOrder
	err := r.drafts.FindOne(ctx, bson.M{"_id": id}).Decode(&po)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	normalizeLegacyOrder(&po)
	return &po, nil
}

func (r *Repository) UpdateOrder(ctx context.Context, po PurchaseOrder) error {
	_, err := r.drafts.ReplaceOne(ctx, bson.M{"_id": po.ID}, po)
	return err
}

func normalizeLegacyOrder(po *PurchaseOrder) {
	if po.Status == "" {
		po.Status = "draft"
	}
	if po.OrderNumber == "" && len(po.ID) >= 8 {
		po.OrderNumber = "PO-" + po.ID[:8]
	}
	if po.UpdatedAt.IsZero() {
		po.UpdatedAt = po.CreatedAt
	}
	if po.ItemCount == 0 && len(po.Items) > 0 {
		po.ItemCount = len(po.Items)
	}
	if po.TotalQty == 0 && len(po.Items) > 0 {
		for _, it := range po.Items {
			po.TotalQty += it.FinalQty
			po.TotalCost += it.LineTotal
		}
	}
}

func (r *Repository) Dismiss(ctx context.Context, drugIDs []string) error {
	now := time.Now().UTC()
	docs := make([]any, 0, len(drugIDs))
	for _, id := range drugIDs {
		docs = append(docs, Dismissed{ID: uuid.NewString(), DrugID: id, At: now})
	}
	if len(docs) == 0 {
		return nil
	}
	_, err := r.dismissed.InsertMany(ctx, docs)
	return err
}

func (r *Repository) DismissedDrugIDs(ctx context.Context) (map[string]bool, error) {
	cur, err := r.dismissed.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	out := map[string]bool{}
	for cur.Next(ctx) {
		var d Dismissed
		if err := cur.Decode(&d); err != nil {
			return nil, err
		}
		out[d.DrugID] = true
	}
	return out, cur.Err()
}

func (r *Repository) OnOrderByDrug(ctx context.Context) (map[string]int, error) {
	cur, err := r.drafts.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	out := map[string]int{}
	for cur.Next(ctx) {
		var d PurchaseOrder
		if err := cur.Decode(&d); err != nil {
			return nil, err
		}
		if d.Status == "cancelled" {
			continue
		}
		for _, it := range d.Items {
			out[it.DrugID] += it.FinalQty
		}
	}
	return out, cur.Err()
}
