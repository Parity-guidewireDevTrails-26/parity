package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"

	"kavach/pkg/database"
	"kavach/pkg/models"
)

type ClaimProcessor struct {
	db *sql.DB
}

func NewClaimProcessor() *ClaimProcessor {
	return &ClaimProcessor{db: database.DB}
}

func (cp *ClaimProcessor) ProcessParametricEvent(event *models.ParametricEvent) error {
	log.Printf("🔍 Processing parametric event: %s in zone %s (severity: %.2f)",
		event.EventType, event.Zone, event.Severity)

	affectedUsers, err := cp.getActiveUsersInZone(event.Zone)
	if err != nil {
		return fmt.Errorf("failed to get affected users: %w", err)
	}

	log.Printf("📍 Found %d active users in affected zone", len(affectedUsers))

	for _, userID := range affectedUsers {
		if err := cp.createAutoClaim(userID, event); err != nil {
			log.Printf("❌ Failed to create claim for user %s: %v", userID, err)
			continue
		}
	}

	return nil
}

func (cp *ClaimProcessor) createAutoClaim(userID string, event *models.ParametricEvent) error {
	activePolicy, err := cp.getActivePolicy(userID)
	if err != nil {
		return fmt.Errorf("no active policy found: %w", err)
	}

	fraudScore, err := cp.runFraudDetection(userID, event)
	if err != nil || fraudScore > 0.7 {
		log.Printf("⚠️ High fraud score (%.2f) for user %s, skipping claim", fraudScore, userID)
		return fmt.Errorf("fraud detection failed")
	}

	estimatedLoss, err := cp.calculateIncomeLoss(userID, event.TriggeredAt, time.Now())
	if err != nil {
		return fmt.Errorf("failed to calculate income loss: %w", err)
	}

	payout := cp.calculatePayout(estimatedLoss, activePolicy.CoverageLimit)

	claim := &models.Claim{
		UserID:              userID,
		UserPolicyID:        activePolicy.ID,
		EventID:             &event.ID,
		ClaimType:           "auto",
		Status:              "verified",
		EstimatedIncomeLoss: estimatedLoss,
		PayoutAmount:        payout.PayoutAmount,
		FraudScore:          fraudScore,
		GpsVerified:         true,
		DeviceVerified:      true,
		DisruptionStart:     event.TriggeredAt,
		DisruptionEnd:       time.Now(),
	}

	if err := cp.saveClaim(claim); err != nil {
		return fmt.Errorf("failed to save claim: %w", err)
	}

	if err := cp.processPayout(claim); err != nil {
		return fmt.Errorf("failed to process payout: %w", err)
	}

	log.Printf("✅ Auto-claim processed successfully for user %s: Payout ₹%.2f", userID, payout.PayoutAmount)
	return nil
}

func (cp *ClaimProcessor) calculatePayout(estimatedLoss, coverageLimit float64) *models.PayoutCalculation {
	payoutAmount := math.Min(estimatedLoss, coverageLimit)

	return &models.PayoutCalculation{
		EstimatedLoss: estimatedLoss,
		CoverageLimit: coverageLimit,
		PayoutAmount:  payoutAmount,
		Formula:       "min(estimated_loss, coverage_limit)",
	}
}

func (cp *ClaimProcessor) calculateIncomeLoss(userID string, startTime, endTime time.Time) (float64, error) {
	query := `
		SELECT
			AVG(total_earnings / NULLIF(hours_worked, 0)) as avg_hourly_rate
		FROM income_history
		WHERE user_id = $1
		AND date >= $2
		ORDER BY date DESC
		LIMIT 30
	`

	var avgHourlyRate sql.NullFloat64
	err := cp.db.QueryRow(query, userID, time.Now().AddDate(0, 0, -30)).Scan(&avgHourlyRate)
	if err != nil || !avgHourlyRate.Valid {
		log.Printf("⚠️ No income history found for user %s, using default rate", userID)
		avgHourlyRate.Float64 = 150.0
	}

	disruptionHours := endTime.Sub(startTime).Hours()
	if disruptionHours > 8 {
		disruptionHours = 8
	}

	estimatedLoss := avgHourlyRate.Float64 * disruptionHours

	log.Printf("💰 Income loss calculation: ₹%.2f/hr × %.2f hrs = ₹%.2f",
		avgHourlyRate.Float64, disruptionHours, estimatedLoss)

	return estimatedLoss, nil
}

func (cp *ClaimProcessor) runFraudDetection(userID string, event *models.ParametricEvent) (float64, error) {
	fraudScore := 0.0

	gpsVerified, err := cp.verifyGPSLocation(userID, event.Zone)
	if err != nil || !gpsVerified {
		fraudScore += 0.5
	}

	deviceIntegrity, err := cp.checkDeviceIntegrity(userID)
	if err != nil || !deviceIntegrity {
		fraudScore += 0.3
	}

	claimClustering := cp.checkClaimClustering(event.Zone, event.TriggeredAt)
	if claimClustering {
		fraudScore -= 0.2
	}

	if fraudScore < 0 {
		fraudScore = 0
	}

	log.Printf("🛡️ Fraud detection score for user %s: %.2f", userID, fraudScore)
	return fraudScore, nil
}

func (cp *ClaimProcessor) verifyGPSLocation(userID, zone string) (bool, error) {
	query := `SELECT work_zone FROM users WHERE id = $1`
	var workZone sql.NullString
	err := cp.db.QueryRow(query, userID).Scan(&workZone)
	if err != nil {
		return false, err
	}

	return workZone.Valid && workZone.String == zone, nil
}

func (cp *ClaimProcessor) checkDeviceIntegrity(userID string) (bool, error) {
	return true, nil
}

func (cp *ClaimProcessor) checkClaimClustering(zone string, eventTime time.Time) bool {
	query := `
		SELECT COUNT(*) as claim_count
		FROM claims c
		JOIN parametric_events e ON c.event_id = e.id
		WHERE e.zone = $1
		AND e.triggered_at >= $2
		AND e.triggered_at <= $3
	`

	var claimCount int
	err := cp.db.QueryRow(query, zone, eventTime.Add(-1*time.Hour), eventTime.Add(1*time.Hour)).Scan(&claimCount)
	if err != nil {
		return false
	}

	return claimCount >= 3
}

func (cp *ClaimProcessor) getActiveUsersInZone(zone string) ([]string, error) {
	query := `
		SELECT DISTINCT u.id
		FROM users u
		JOIN user_policies up ON u.id = up.user_id
		WHERE u.work_zone = $1
		AND up.status = 'active'
		AND up.end_date > NOW()
	`

	rows, err := cp.db.Query(query, zone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		userIDs = append(userIDs, userID)
	}

	return userIDs, nil
}

func (cp *ClaimProcessor) getActivePolicy(userID string) (*models.UserPolicy, error) {
	query := `
		SELECT id, user_id, policy_id, status, start_date, end_date,
		       premium_paid, coverage_limit, created_at, updated_at
		FROM user_policies
		WHERE user_id = $1
		AND status = 'active'
		AND end_date > NOW()
		ORDER BY created_at DESC
		LIMIT 1
	`

	policy := &models.UserPolicy{}
	err := cp.db.QueryRow(query, userID).Scan(
		&policy.ID, &policy.UserID, &policy.PolicyID, &policy.Status,
		&policy.StartDate, &policy.EndDate, &policy.PremiumPaid,
		&policy.CoverageLimit, &policy.CreatedAt, &policy.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return policy, nil
}

func (cp *ClaimProcessor) saveClaim(claim *models.Claim) error {
	metadata, _ := json.Marshal(claim.Metadata)

	query := `
		INSERT INTO claims (
			user_id, user_policy_id, event_id, claim_type, status,
			estimated_income_loss, payout_amount, fraud_score,
			gps_verified, device_verified, disruption_start, disruption_end
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at
	`

	err := cp.db.QueryRow(
		query, claim.UserID, claim.UserPolicyID, claim.EventID,
		claim.ClaimType, claim.Status, claim.EstimatedIncomeLoss,
		claim.PayoutAmount, claim.FraudScore, claim.GpsVerified,
		claim.DeviceVerified, claim.DisruptionStart, claim.DisruptionEnd,
	).Scan(&claim.ID, &claim.CreatedAt)

	if err != nil {
		log.Printf("❌ Failed to save claim: %v (metadata: %s)", err, string(metadata))
	}

	return err
}

func (cp *ClaimProcessor) processPayout(claim *models.Claim) error {
	now := time.Now()
	claim.PaidAt = &now
	claim.Status = "paid"

	query := `
		UPDATE claims
		SET status = 'paid', paid_at = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := cp.db.Exec(query, now, now, claim.ID)
	if err != nil {
		return err
	}

	log.Printf("💸 Mock payout processed: ₹%.2f sent to user %s", claim.PayoutAmount, claim.UserID)

	return nil
}
