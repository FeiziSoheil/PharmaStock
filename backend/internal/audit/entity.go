package audit

import "time"

type Actor struct {
	ID       string `bson:"id" json:"id"`
	Name     string `bson:"name" json:"name"`
	Role     string `bson:"role" json:"role"`
	Initials string `bson:"initials" json:"initials"`
}

type Event struct {
	ID                    string         `bson:"_id" json:"id"`
	Timestamp             time.Time      `bson:"timestamp" json:"timestamp"`
	Actor                 Actor          `bson:"actor" json:"actor"`
	Action                string         `bson:"action" json:"action"`
	EntityType            string         `bson:"entityType" json:"entityType"`
	EntityID              string         `bson:"entityId" json:"entityId"`
	EntityLabel           string         `bson:"entityLabel" json:"entityLabel"`
	Description           string         `bson:"description" json:"description"`
	Severity              string         `bson:"severity" json:"severity"`
	Source                string         `bson:"source" json:"source"`
	Before                map[string]any `bson:"before,omitempty" json:"before,omitempty"`
	After                 map[string]any `bson:"after,omitempty" json:"after,omitempty"`
	IP                    string         `bson:"ip" json:"ip"`
	Terminal              string         `bson:"terminal" json:"terminal"`
	SecurityStatus        string         `bson:"securityStatus" json:"securityStatus"`
	IsControlledSubstance bool           `bson:"isControlledSubstance" json:"isControlledSubstance"`
	BranchID              string         `bson:"branchId,omitempty" json:"branchId,omitempty"`
}

type AppendInput struct {
	Actor                 Actor
	Action                string
	EntityType            string
	EntityID              string
	EntityLabel           string
	Description           string
	Severity              string
	Source                string
	Before                map[string]any
	After                 map[string]any
	IP                    string
	Terminal              string
	SecurityStatus        string
	IsControlledSubstance bool
	BranchID              string
}
