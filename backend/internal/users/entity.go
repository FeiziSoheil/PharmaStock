package users

import (
	"time"

	"pharmastock/backend/internal/auth"
)

type MatrixPolicy struct {
	ID        string    `bson:"_id" json:"id"`
	Matrix    MatrixMap `bson:"matrix" json:"matrix"`
	UpdatedAt time.Time `bson:"updatedAt" json:"updatedAt"`
	UpdatedBy string    `bson:"updatedBy" json:"updatedBy"`
}

type ListFilter struct {
	Search   string
	Role     string
	Status   string
	BranchID string
	SortBy   string
	SortDir  string
	Page     int
	PageSize int
}

type KPIs struct {
	TotalUsers           int64      `json:"totalUsers"`
	ActiveUsers          int64      `json:"activeUsers"`
	TechnicalOfficers    int64      `json:"technicalOfficers"`
	SensitivePermissions int        `json:"sensitivePermissions"`
	LastAccessChangeAt   *time.Time `json:"lastAccessChangeAt,omitempty"`
	AuditCoveragePercent int        `json:"auditCoveragePercent"`
}

type UserRecord = auth.User
type BranchRecord = auth.Branch
