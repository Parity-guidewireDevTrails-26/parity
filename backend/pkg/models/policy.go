package models

import (
	"encoding/json"
	"time"
)

type Policy struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	WeeklyPremium  float64         `json:"weekly_premium"`
	CoverageLimit  float64         `json:"coverage_limit"`
	Description    string          `json:"description"`
	Exclusions     json.RawMessage `json:"exclusions"`
	IsActive       bool            `json:"is_active"`
	PayoutRate     float64         `json:"payout_rate"`
	DurationDays   int             `json:"duration_days"`
	CreatedAt      time.Time       `json:"created_at"`
}


type UserPolicy struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	PolicyID      string    `json:"policy_id"`
	Status        string    `json:"status"`
	StartDate     time.Time `json:"start_date"`
	EndDate       time.Time `json:"end_date"`
	PremiumPaid   float64   `json:"premium_paid"`
	CoverageLimit float64   `json:"coverage_limit"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type PolicySubscription struct {
	PolicyID string `json:"policy_id" binding:"required"`
	UserID   string `json:"user_id"`
}
