package models

import (
	"encoding/json"
	"time"
)

// Policy represents an insurance plan definition.
// SECURITY & COMPLIANCE: All policies MUST explicitly deny coverage for:
// 1. War (invasion, acts of foreign enemies)
// 2. Pandemic (and related lockdowns)
// 3. Terrorism (including cyber-terrorism)
// 4. Nuclear (energy risks or radioactive contamination)
type Policy struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	WeeklyPremium  float64         `json:"weekly_premium"`
	CoverageLimit  float64         `json:"coverage_limit"`
	Description    string          `json:"description"`
	Exclusions     json.RawMessage `json:"exclusions"` // Array of explicitly excluded events
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
