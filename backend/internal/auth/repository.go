package auth

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type Repository struct {
	users    *mongo.Collection
	branches *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		users:    db.Collection("users"),
		branches: db.Collection("branches"),
	}
}

func (r *Repository) FindUserByUsername(ctx context.Context, username string) (*User, error) {
	var u User
	err := r.users.FindOne(ctx, bson.M{"username": username}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := r.users.FindOne(ctx, bson.M{"_id": id}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindBranch(ctx context.Context, id string) (*Branch, error) {
	var b Branch
	err := r.branches.FindOne(ctx, bson.M{"_id": id}).Decode(&b)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) SaveUserAuthState(ctx context.Context, u *User) error {
	set := bson.M{
		"failedAttempts": u.FailedAttempts,
		"lockUntil":      u.LockUntil,
	}
	if u.LastLoginAt != nil {
		set["lastLoginAt"] = u.LastLoginAt
	}
	if u.LastLoginIP != "" {
		set["lastLoginIp"] = u.LastLoginIP
	}
	_, err := r.users.UpdateByID(ctx, u.ID, bson.M{"$set": set})
	return err
}

func (r *Repository) ClearLockIfExpired(u *User, now time.Time) bool {
	if u.LockUntil != nil && !u.LockUntil.After(now) {
		u.LockUntil = nil
		u.FailedAttempts = 0
		return true
	}
	return false
}

func (r *Repository) UpdateProfile(ctx context.Context, id, name, nameNorm, email, phone string, updatedAt time.Time) error {
	set := bson.M{
		"name":      name,
		"nameNorm":  nameNorm,
		"email":     email,
		"phone":     phone,
		"updatedAt": updatedAt,
	}
	_, err := r.users.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}

func (r *Repository) UpdatePassword(ctx context.Context, id, passwordHash string, updatedAt time.Time) error {
	set := bson.M{
		"passwordHash":   passwordHash,
		"failedAttempts": 0,
		"lockUntil":      nil,
		"updatedAt":      updatedAt,
	}
	_, err := r.users.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}
