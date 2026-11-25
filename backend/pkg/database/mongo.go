package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Mongo struct {
	Client *mongo.Client
	DB     *mongo.Database
}

func Connect(ctx context.Context, uri, dbName string) (*Mongo, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("mongo ping: %w", err)
	}
	db := client.Database(dbName)
	m := &Mongo{Client: client, DB: db}
	if err := m.EnsureIndexes(ctx); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}
	return m, nil
}

func (m *Mongo) Close(ctx context.Context) error {
	return m.Client.Disconnect(ctx)
}

func (m *Mongo) EnsureIndexes(ctx context.Context) error {
	type idx struct {
		coll   string
		models []mongo.IndexModel
	}
	specs := []idx{
		{"users", []mongo.IndexModel{
			{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "role", Value: 1}, {Key: "status", Value: 1}}},
		}},
		{"drugs", []mongo.IndexModel{
			{Keys: bson.D{{Key: "gtin", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
			{Keys: bson.D{{Key: "nameFa", Value: 1}}},
			{Keys: bson.D{{Key: "genericCode", Value: 1}}},
			{Keys: bson.D{{Key: "category", Value: 1}}},
			{Keys: bson.D{{Key: "isControlled", Value: 1}}},
		}},
		{"bins", []mongo.IndexModel{
			{Keys: bson.D{{Key: "address", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "zone", Value: 1}}},
		}},
		{"stock_batches", []mongo.IndexModel{
			{Keys: bson.D{{Key: "drugId", Value: 1}, {Key: "expiry", Value: 1}}},
			{Keys: bson.D{{Key: "binId", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "expiry", Value: 1}}},
		}},
		{"audit_events", []mongo.IndexModel{
			{Keys: bson.D{{Key: "timestamp", Value: -1}}},
			{Keys: bson.D{{Key: "actor.id", Value: 1}}},
			{Keys: bson.D{{Key: "action", Value: 1}}},
		}},
		{"ttac_cache", []mongo.IndexModel{
			{Keys: bson.D{{Key: "gtin", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
			{Keys: bson.D{{Key: "irc", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
			{Keys: bson.D{{Key: "genericCode", Value: 1}}},
		}},
		{"cardex_movements", []mongo.IndexModel{
			{Keys: bson.D{{Key: "drugId", Value: 1}, {Key: "timestamp", Value: -1}}},
		}},
		{"invoice_receipts", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
			{Keys: bson.D{{Key: "header.invoiceNo", Value: 1}}},
		}},
		{"dispense_orders", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
		}},
		{"internal_transfers", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
			{Keys: bson.D{{Key: "transferNo", Value: 1}}, Options: options.Index().SetSparse(true)},
		}},
		{"controlled_ledger_entries", []mongo.IndexModel{
			{Keys: bson.D{{Key: "seqNo", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "timestamp", Value: -1}, {Key: "seqNo", Value: -1}}},
			{Keys: bson.D{{Key: "drugId", Value: 1}, {Key: "timestamp", Value: -1}}},
			{Keys: bson.D{{Key: "txType", Value: 1}, {Key: "timestamp", Value: -1}}},
			{Keys: bson.D{{Key: "trackingCode", Value: 1}}, Options: options.Index().SetSparse(true)},
		}},
		{"purchase_reconciliations", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
			{Keys: bson.D{{Key: "invoiceNo", Value: 1}}},
		}},
		{"distributor_returns", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
			{Keys: bson.D{{Key: "distributorId", Value: 1}, {Key: "updatedAt", Value: -1}}},
			{Keys: bson.D{{Key: "returnNo", Value: 1}}, Options: options.Index().SetSparse(true)},
		}},
	}
	for _, s := range specs {
		if _, err := m.DB.Collection(s.coll).Indexes().CreateMany(ctx, s.models); err != nil {
			return fmt.Errorf("indexes %s: %w", s.coll, err)
		}
	}
	return nil
}
