package settings

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository interface {
	Get(ctx context.Context) (*Settings, error)
	Upsert(ctx context.Context, s *Settings) error
}

type mongoRepository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) Repository {
	return &mongoRepository{
		coll: db.Collection("settings"),
	}
}

func (r *mongoRepository) Get(ctx context.Context) (*Settings, error) {
	var s Settings
	err := r.coll.FindOne(ctx, bson.M{"_id": SingletonID}).Decode(&s)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *mongoRepository) Upsert(ctx context.Context, s *Settings) error {
	s.ID = SingletonID
	opts := options.Update().SetUpsert(true)
	_, err := r.coll.UpdateOne(ctx, bson.M{"_id": SingletonID}, bson.M{"$set": s}, opts)
	return err
}
