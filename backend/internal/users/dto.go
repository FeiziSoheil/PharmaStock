package users

import (
	"time"

	"pharmastock/backend/pkg/pagination"
)

type UserDTO struct {
	ID                string          `json:"id"`
	Username          string          `json:"username"`
	Name              string          `json:"name"`
	Email             string          `json:"email"`
	Phone             string          `json:"phone"`
	PersonnelCode     string          `json:"personnelCode"`
	MedicalCouncilNo  string          `json:"medicalCouncilNo,omitempty"`
	Role              string          `json:"role"`
	BranchID          string          `json:"branchId"`
	UnitLabel         string          `json:"unitLabel"`
	Status            string          `json:"status"` // "active" | "inactive" | "locked"
	Active            bool            `json:"active"`
	PermanentlyLocked bool            `json:"permanentlyLocked"`
	CustomPermissions map[string]bool `json:"customPermissions,omitempty"`
	LastLoginAt       *time.Time      `json:"lastLoginAt,omitempty"`
	LastLoginIP       string          `json:"lastLoginIp,omitempty"`
	LastLoginDevice   string          `json:"lastLoginDevice,omitempty"`
	CreatedAt         *time.Time      `json:"createdAt,omitempty"`
	UpdatedAt         *time.Time      `json:"updatedAt,omitempty"`
}

type UserDetailDTO struct {
	UserDTO
	EffectivePermissions map[string]bool `json:"effectivePermissions"`
}

type UsersListResponse struct {
	pagination.Result[UserDTO]
	KPIs     KPIs           `json:"kpis"`
	Branches []BranchRecord `json:"branches"`
}

type MatrixResponse struct {
	Roles       []RoleDef       `json:"roles"`
	Permissions []PermissionDef `json:"permissions"`
	Matrix      MatrixMap       `json:"matrix"`
	LockedCells LockMap         `json:"lockedCells"`
	UpdatedAt   *time.Time      `json:"updatedAt,omitempty"`
	UpdatedBy   string          `json:"updatedBy,omitempty"`
}

type CreateUserRequest struct {
	Username         string `json:"username"`
	Name             string `json:"name"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	PersonnelCode    string `json:"personnelCode"`
	MedicalCouncilNo string `json:"medicalCouncilNo"`
	Role             string `json:"role"`
	BranchID         string `json:"branchId"`
	UnitLabel        string `json:"unitLabel"`
	Password         string `json:"password"`
	Active           *bool  `json:"active,omitempty"`
}

type UpdateUserRequest struct {
	Name             string `json:"name"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	PersonnelCode    string `json:"personnelCode"`
	MedicalCouncilNo string `json:"medicalCouncilNo"`
	Role             string `json:"role"`
	BranchID         string `json:"branchId"`
	UnitLabel        string `json:"unitLabel"`
	Active           *bool  `json:"active,omitempty"`
}

type UpdateStatusRequest struct {
	Active bool `json:"active"`
}

type UpdateUserPermissionsRequest struct {
	// Overrides maps permissionId -> true/false; nil deletes the override (falls back to role default).
	Overrides map[string]*bool `json:"overrides"`
}

type ResetPasswordRequest struct {
	NewPassword string `json:"newPassword"`
	Unlock      bool   `json:"unlock,omitempty"`
}

type UpdateMatrixRequest struct {
	Matrix MatrixMap `json:"matrix"`
}

func toUserDTO(u UserRecord) UserDTO {
	status := u.Status
	if u.PermanentlyLocked {
		status = "locked"
	} else if status != "inactive" {
		status = "active"
	}
	var createdPtr, updatedPtr *time.Time
	if !u.CreatedAt.IsZero() {
		t := u.CreatedAt
		createdPtr = &t
	}
	if !u.UpdatedAt.IsZero() {
		t := u.UpdatedAt
		updatedPtr = &t
	}
	return UserDTO{
		ID:                u.ID,
		Username:          u.Username,
		Name:              u.Name,
		Email:             u.Email,
		Phone:             u.Phone,
		PersonnelCode:     u.PersonnelCode,
		MedicalCouncilNo:  u.MedicalCouncilNo,
		Role:              u.Role,
		BranchID:          u.BranchID,
		UnitLabel:         u.UnitLabel,
		Status:            status,
		Active:            u.IsActive(),
		PermanentlyLocked: u.PermanentlyLocked,
		CustomPermissions: u.CustomPermissions,
		LastLoginAt:       u.LastLoginAt,
		LastLoginIP:       u.LastLoginIP,
		LastLoginDevice:   u.LastLoginDevice,
		CreatedAt:         createdPtr,
		UpdatedAt:         updatedPtr,
	}
}
