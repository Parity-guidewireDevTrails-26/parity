package models

import "time"

type ParametricEvent struct {
	ID               string                 `json:"id"`
	EventType        string                 `json:"event_type"`
	Zone             string                 `json:"zone"`
	Severity         float64                `json:"severity"`
	Threshold        float64                `json:"threshold"`
	ProbabilityScore float64                `json:"probability_score"`
	TriggeredAt      time.Time              `json:"triggered_at"`
	ResolvedAt       *time.Time             `json:"resolved_at,omitempty"`
	IsActive         bool                   `json:"is_active"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
}

type Claim struct {
	ID                  string                 `json:"id"`
	UserID              string                 `json:"user_id"`
	UserPolicyID        string                 `json:"user_policy_id"`
	EventID             *string                `json:"event_id,omitempty"`
	ClaimType           string                 `json:"claim_type"`
	Status              string                 `json:"status"`
	EstimatedIncomeLoss float64                `json:"estimated_income_loss"`
	PayoutAmount        float64                `json:"payout_amount"`
	FraudScore          float64                `json:"fraud_score"`
	GpsVerified         bool                   `json:"gps_verified"`
	DeviceVerified      bool                   `json:"device_verified"`
	CrowdsourceVerified bool                   `json:"crowdsource_verified"`
	DisruptionStart     time.Time              `json:"disruption_start"`
	DisruptionEnd       time.Time              `json:"disruption_end"`
	ProcessedAt         *time.Time             `json:"processed_at,omitempty"`
	PaidAt              *time.Time             `json:"paid_at,omitempty"`
	RejectionReason     string                 `json:"rejection_reason,omitempty"`
	Metadata            map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

type ClaimProcessingRequest struct {
	EventID string `json:"event_id" binding:"required"`
	Zone    string `json:"zone" binding:"required"`
}

type PayoutCalculation struct {
	EstimatedLoss float64 `json:"estimated_loss"`
	CoverageLimit float64 `json:"coverage_limit"`
	PayoutAmount  float64 `json:"payout_amount"`
	Formula       string  `json:"formula"`
}
