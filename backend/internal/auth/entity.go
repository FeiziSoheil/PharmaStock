package auth

import "time"

type User struct {
	ID                string          `bson:"_id" json:"id"`
	Username          string          `bson:"username" json:"username"`
	Name              string          `bson:"name" json:"name"`
	NameNorm          string          `bson:"nameNorm,omitempty" json:"-"`
	Email             string          `bson:"email,omitempty" json:"email,omitempty"`
	Phone             string          `bson:"phone,omitempty" json:"phone,omitempty"`
	PersonnelCode     string          `bson:"personnelCode,omitempty" json:"personnelCode,omitempty"`
	MedicalCouncilNo  string          `bson:"medicalCouncilNo,omitempty" json:"medicalCouncilNo,omitempty"`
	Role              string          `bson:"role" json:"role"`
	BranchID          string          `bson:"branchId,omitempty" json:"branchId,omitempty"`
	UnitLabel         string          `bson:"unitLabel,omitempty" json:"unitLabel,omitempty"`
	Status            string          `bson:"status,omitempty" json:"status,omitempty"`
	PasswordHash      string          `bson:"passwordHash" json:"-"`
	PermanentlyLocked bool            `bson:"permanentlyLocked" json:"permanentlyLocked"`
	FailedAttempts    int             `bson:"failedAttempts" json:"-"`
	LockUntil         *time.Time      `bson:"lockUntil,omitempty" json:"-"`
	CustomPermissions map[string]bool `bson:"customPermissions,omitempty" json:"customPermissions,omitempty"`
	LastLoginAt       *time.Time      `bson:"lastLoginAt,omitempty" json:"lastLoginAt,omitempty"`
	LastLoginIP       string          `bson:"lastLoginIp,omitempty" json:"lastLoginIp,omitempty"`
	LastLoginDevice   string          `bson:"lastLoginDevice,omitempty" json:"lastLoginDevice,omitempty"`
	CreatedAt         time.Time       `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt         time.Time       `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

func (u *User) IsActive() bool {
	if u.PermanentlyLocked {
		return false
	}
	return u.Status != "inactive"
}

type Branch struct {
	ID     string `bson:"_id" json:"id"`
	NameFa string `bson:"nameFa" json:"nameFa"`
	Active bool   `bson:"active" json:"active"`
}
