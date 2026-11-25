package auth

import "time"

type MeResponse struct {
	ID               string     `json:"id"`
	Username         string     `json:"username"`
	Name             string     `json:"name"`
	Email            string     `json:"email"`
	Phone            string     `json:"phone"`
	PersonnelCode    string     `json:"personnelCode"`
	MedicalCouncilNo string     `json:"medicalCouncilNo,omitempty"`
	Role             string     `json:"role"`
	BranchID         string     `json:"branchId"`
	BranchNameFa     string     `json:"branchNameFa"`
	UnitLabel        string     `json:"unitLabel"`
	Status           string     `json:"status"` // "active" | "inactive" | "locked"
	LastLoginAt      *time.Time `json:"lastLoginAt,omitempty"`
	LastLoginIP      string     `json:"lastLoginIp,omitempty"`
	LastLoginDevice  string     `json:"lastLoginDevice,omitempty"`
	CreatedAt        *time.Time `json:"createdAt,omitempty"`
	UpdatedAt        *time.Time `json:"updatedAt,omitempty"`
}

type UpdateMeRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type ChangePasswordResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	BranchID string `json:"branchId"`
}

type LoginSuccess struct {
	OK     bool    `json:"ok"`
	Token  string  `json:"token"`
	User   UserDTO `json:"user"`
	Branch Branch  `json:"branch"`
}

type LoginFailure struct {
	OK                bool   `json:"ok"`
	Code              string `json:"code"`
	Message           string `json:"message"`
	CanRetry          *bool  `json:"canRetry,omitempty"`
	RetryAfterSeconds *int   `json:"retryAfterSeconds,omitempty"`
}

type UserDTO struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}
