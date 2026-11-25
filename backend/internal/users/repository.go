package users

import (
	"context"
	"errors"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Repository interface {
	ListUsers(ctx context.Context, f ListFilter) ([]UserRecord, int64, error)
	CountKPIs(ctx context.Context) (total int64, active int64, technicalOfficers int64, err error)
	CountActiveSuperAdmins(ctx context.Context, excludeID string) (int64, error)
	FindUserByID(ctx context.Context, id string) (*UserRecord, error)
	FindUserByUsername(ctx context.Context, username string) (*UserRecord, error)
	InsertUser(ctx context.Context, u UserRecord) error
	UpdateUser(ctx context.Context, u UserRecord) error
	ListBranches(ctx context.Context) ([]BranchRecord, error)
	FindBranch(ctx context.Context, id string) (*BranchRecord, error)
	GetMatrixPolicy(ctx context.Context) (*MatrixPolicy, error)
	SaveMatrixPolicy(ctx context.Context, p MatrixPolicy) error
	LastAccessAuditTime(ctx context.Context) (*time.Time, error)
}

type MongoRepository struct {
	users    *mongo.Collection
	branches *mongo.Collection
	policies *mongo.Collection
	audits   *mongo.Collection
}

func NewRepository(db *mongo.Database) *MongoRepository {
	return &MongoRepository{
		users:    db.Collection("users"),
		branches: db.Collection("branches"),
		policies: db.Collection("rbac_policies"),
		audits:   db.Collection("audit_events"),
	}
}

var allowedSortFields = map[string]string{
	"name":          "name",
	"username":      "username",
	"role":          "role",
	"personnelCode": "personnelCode",
	"lastLoginAt":   "lastLoginAt",
	"createdAt":     "createdAt",
}

func (r *MongoRepository) ListUsers(ctx context.Context, f ListFilter) ([]UserRecord, int64, error) {
	filter := bson.M{}
	if f.Search != "" {
		esc := regexp.QuoteMeta(f.Search)
		filter["$or"] = []bson.M{
			{"nameNorm": bson.M{"$regex": esc, "$options": "i"}},
			{"name": bson.M{"$regex": esc, "$options": "i"}},
			{"username": bson.M{"$regex": esc, "$options": "i"}},
			{"email": bson.M{"$regex": esc, "$options": "i"}},
			{"personnelCode": bson.M{"$regex": esc, "$options": "i"}},
			{"medicalCouncilNo": bson.M{"$regex": esc, "$options": "i"}},
			{"unitLabel": bson.M{"$regex": esc, "$options": "i"}},
		}
	}
	if f.Role != "" {
		if f.Role == "warehouse_lead" {
			filter["role"] = bson.M{"$in": []string{"warehouse_lead", "warehouse_operator"}}
		} else {
			filter["role"] = f.Role
		}
	}
	switch f.Status {
	case "active":
		filter["permanentlyLocked"] = bson.M{"$ne": true}
		filter["status"] = bson.M{"$ne": "inactive"}
	case "inactive":
		filter["$or"] = []bson.M{
			{"status": "inactive"},
			{"permanentlyLocked": true},
		}
		// Preserve search $or if both present via $and
		if f.Search != "" {
			searchOr := filter["$or"]
			delete(filter, "$or")
			filter["$and"] = []bson.M{
				{"$or": searchOr},
				{"$or": []bson.M{{"status": "inactive"}, {"permanentlyLocked": true}}},
			}
		}
	case "locked":
		filter["permanentlyLocked"] = true
	}
	if f.BranchID != "" {
		filter["branchId"] = f.BranchID
	}

	total, err := r.users.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	sortField, ok := allowedSortFields[f.SortBy]
	if !ok {
		sortField = "name"
	}
	dir := 1
	if f.SortDir == "desc" {
		dir = -1
	}

	opts := options.Find().
		SetProjection(bson.M{"passwordHash": 0, "failedAttempts": 0, "lockUntil": 0}).
		SetSort(bson.D{{Key: sortField, Value: dir}, {Key: "_id", Value: 1}}).
		SetSkip(int64((f.Page - 1) * f.PageSize)).
		SetLimit(int64(f.PageSize))

	cur, err := r.users.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)
	var items []UserRecord
	if err := cur.All(ctx, &items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *MongoRepository) CountKPIs(ctx context.Context) (int64, int64, int64, error) {
	total, err := r.users.CountDocuments(ctx, bson.M{})
	if err != nil {
		return 0, 0, 0, err
	}
	active, err := r.users.CountDocuments(ctx, bson.M{
		"permanentlyLocked": bson.M{"$ne": true},
		"status":            bson.M{"$ne": "inactive"},
	})
	if err != nil {
		return 0, 0, 0, err
	}
	tech, err := r.users.CountDocuments(ctx, bson.M{
		"role":              bson.M{"$in": []string{"technical_officer", "pharmacist"}},
		"permanentlyLocked": bson.M{"$ne": true},
		"status":            bson.M{"$ne": "inactive"},
	})
	if err != nil {
		return 0, 0, 0, err
	}
	return total, active, tech, nil
}

func (r *MongoRepository) CountActiveSuperAdmins(ctx context.Context, excludeID string) (int64, error) {
	filter := bson.M{
		"role":              "super_admin",
		"permanentlyLocked": bson.M{"$ne": true},
		"status":            bson.M{"$ne": "inactive"},
	}
	if excludeID != "" {
		filter["_id"] = bson.M{"$ne": excludeID}
	}
	return r.users.CountDocuments(ctx, filter)
}

func (r *MongoRepository) FindUserByID(ctx context.Context, id string) (*UserRecord, error) {
	var u UserRecord
	err := r.users.FindOne(ctx, bson.M{"_id": id}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &u, err
}

func (r *MongoRepository) FindUserByUsername(ctx context.Context, username string) (*UserRecord, error) {
	var u UserRecord
	err := r.users.FindOne(ctx, bson.M{"username": username}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &u, err
}

func (r *MongoRepository) InsertUser(ctx context.Context, u UserRecord) error {
	_, err := r.users.InsertOne(ctx, u)
	return err
}

func (r *MongoRepository) UpdateUser(ctx context.Context, u UserRecord) error {
	_, err := r.users.ReplaceOne(ctx, bson.M{"_id": u.ID}, u)
	return err
}

func (r *MongoRepository) ListBranches(ctx context.Context) ([]BranchRecord, error) {
	cur, err := r.branches.Find(ctx, bson.M{"active": true}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var items []BranchRecord
	if err := cur.All(ctx, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *MongoRepository) FindBranch(ctx context.Context, id string) (*BranchRecord, error) {
	var b BranchRecord
	err := r.branches.FindOne(ctx, bson.M{"_id": id}).Decode(&b)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &b, err
}

const defaultPolicyID = "default"

func (r *MongoRepository) GetMatrixPolicy(ctx context.Context) (*MatrixPolicy, error) {
	var p MatrixPolicy
	err := r.policies.FindOne(ctx, bson.M{"_id": defaultPolicyID}).Decode(&p)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &p, err
}

func (r *MongoRepository) SaveMatrixPolicy(ctx context.Context, p MatrixPolicy) error {
	p.ID = defaultPolicyID
	_, err := r.policies.UpdateByID(ctx, defaultPolicyID, bson.M{"$set": p}, options.Update().SetUpsert(true))
	return err
}

func (r *MongoRepository) LastAccessAuditTime(ctx context.Context) (*time.Time, error) {
	var row struct {
		Timestamp time.Time `bson:"timestamp"`
	}
	err := r.audits.FindOne(
		ctx,
		bson.M{"action": "role_change"},
		options.FindOne().SetSort(bson.D{{Key: "timestamp", Value: -1}}).SetProjection(bson.M{"timestamp": 1}),
	).Decode(&row)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row.Timestamp, nil
}
