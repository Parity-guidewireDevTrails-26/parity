package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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
	// Delegate to ML service for authoritative payout formula
	type payoutReq struct {
		PredictedLoss   float64 `json:"predicted_loss"`
		ExpectedIncome  float64 `json:"expected_income"`
		FraudDecision   string  `json:"fraud_decision"`
		ClaimTriggered  bool    `json:"claim_triggered"`
		Plan            string  `json:"plan"`
		CoverageLimit   float64 `json:"coverage_limit"`
	}
	type payoutResp struct {
		Payout      float64 `json:"payout"`
		Deductible  float64 `json:"deductible"`
		NetLoss     float64 `json:"net_loss"`
		CoverageCap float64 `json:"coverage_cap"`
		Reason      string  `json:"reason"`
	}

	reqBody := payoutReq{
		PredictedLoss:  estimatedLoss,
		ExpectedIncome: estimatedLoss * 2, // estimate; ideally from income_history
		FraudDecision:  "VERIFIED",
		ClaimTriggered: true,
		Plan:           "GOLD",
		CoverageLimit:  coverageLimit,
	}

	var resp payoutResp
	if err := mlServiceCall("payout/calculate", reqBody, &resp); err != nil {
		log.Printf("⚠️ ML payout failed (%v), using min formula", err)
		amount := estimatedLoss
		if amount > coverageLimit {
			amount = coverageLimit
		}
		return &models.PayoutCalculation{
			EstimatedLoss: estimatedLoss,
			CoverageLimit: coverageLimit,
			PayoutAmount:  amount,
			Formula:       "min(estimated_loss, coverage_limit) [fallback]",
		}
	}

	return &models.PayoutCalculation{
		EstimatedLoss: estimatedLoss,
		CoverageLimit: coverageLimit,
		PayoutAmount:  resp.Payout,
		Formula:       "ml_service: " + resp.Reason,
	}
}

func (cp *ClaimProcessor) calculateIncomeLoss(userID string, startTime, endTime time.Time) (float64, error) {
	// Fetch rider's income history for baseline features
	type incomeRow struct {
		AvgHourlyRate   float64
		AvgOrdersPerHour float64
		AvgHoursPerDay  float64
	}

	query := `
		SELECT
			AVG(total_earnings / NULLIF(hours_worked, 0)) as avg_hourly_rate,
			AVG(CAST(deliveries_count AS FLOAT) / NULLIF(hours_worked, 0)) as avg_orders_per_hour,
			AVG(hours_worked) as avg_hours_per_day
		FROM income_history
		WHERE user_id = $1
		AND date >= $2
		ORDER BY date DESC
		LIMIT 30
	`

	var avgHourlyRate, avgOrdersPerHour, avgHoursPerDay sql.NullFloat64
	err := cp.db.QueryRow(query, userID, time.Now().AddDate(0, 0, -30)).
		Scan(&avgHourlyRate, &avgOrdersPerHour, &avgHoursPerDay)

	// Default values if no income history yet
	hourlyRate := 150.0
	ordersPerHour := 2.5
	hoursPerDay := 8.0
	earningsPerOrder := 60.0

	if err == nil {
		if avgHourlyRate.Valid && avgHourlyRate.Float64 > 0 {
			hourlyRate = avgHourlyRate.Float64
		}
		if avgOrdersPerHour.Valid && avgOrdersPerHour.Float64 > 0 {
			ordersPerHour = avgOrdersPerHour.Float64
		}
		if avgHoursPerDay.Valid && avgHoursPerDay.Float64 > 0 {
			hoursPerDay = avgHoursPerDay.Float64
		}
		if ordersPerHour > 0 {
			earningsPerOrder = hourlyRate / ordersPerHour
		}
	} else {
		log.Printf("⚠️ No income history for user %s, using defaults", userID)
	}

	disruptionHours := endTime.Sub(startTime).Hours()
	if disruptionHours > 8 {
		disruptionHours = 8
	}

	expectedIncome := hoursPerDay * ordersPerHour * earningsPerOrder

	// Call ML service with rider profile + disruption context
	type predictReq struct {
		HoursPerDay          float64 `json:"hours_per_day"`
		OrdersPerHour        float64 `json:"orders_per_hour"`
		DaysPerWeek          float64 `json:"days_per_week"`
		EarningsPerOrder     float64 `json:"earnings_per_order"`
		RainfallMm           float64 `json:"rainfall_mm"`
		RestaurantDensity    float64 `json:"restaurant_density"`
		PeakHourRatio        float64 `json:"peak_hour_ratio"`
		PlatformDemandIndex  float64 `json:"platform_demand_index"`
		SurgeMultiplier      float64 `json:"surge_multiplier"`
		Aqi                  float64 `json:"aqi"`
		Temperature          float64 `json:"temperature"`
		ExpectedIncome       float64 `json:"expected_income"`
	}
	type predictResp struct {
		PredictedIncomeLoss float64 `json:"predicted_income_loss"`
		ExpectedIncome      float64 `json:"expected_income"`
		RiskScore           float64 `json:"risk_score"`
		Method              string  `json:"method"`
	}

	reqBody := predictReq{
		HoursPerDay:         hoursPerDay,
		OrdersPerHour:       ordersPerHour,
		DaysPerWeek:         5,
		EarningsPerOrder:    earningsPerOrder,
		RainfallMm:          0,   // enriched by caller from event data
		RestaurantDensity:   0.6,
		PeakHourRatio:       0.4,
		PlatformDemandIndex: 1.0,
		SurgeMultiplier:     1.0,
		Aqi:                 100,
		Temperature:         32,
		ExpectedIncome:      expectedIncome,
	}

	var resp predictResp
	if err := mlServiceCall("predict", reqBody, &resp); err != nil {
		log.Printf("⚠️ ML prediction failed (%v), using hourly formula", err)
		return hourlyRate * disruptionHours, nil
	}

	log.Printf("🤖 ML income loss: ₹%.2f (method: %s, risk: %.2f)",
		resp.PredictedIncomeLoss, resp.Method, resp.RiskScore)
	return resp.PredictedIncomeLoss, nil
}

func (cp *ClaimProcessor) runFraudDetection(userID string, event *models.ParametricEvent) (float64, error) {
	gpsVerified, _ := cp.verifyGPSLocation(userID, event.Zone)
	deviceIntegrity, _ := cp.checkDeviceIntegrity(userID)
	claimClustering := cp.checkClaimClustering(event.Zone, event.TriggeredAt)

	// Call ML service fraud scorer
	type fraudReq struct {
		DeviceIntegrityIssue bool    `json:"device_integrity_issue"`
		GpsIpMismatch        bool    `json:"gps_ip_mismatch"`
		SpeedUpLocation      bool    `json:"speed_up_location"`
		CrowdsourceMismatch  bool    `json:"crowdsource_mismatch"`
		TrustScore           float64 `json:"trust_score"`
	}
	type fraudResp struct {
		FraudScore int    `json:"fraud_score"`
		Decision   string `json:"decision"`
	}

	reqBody := fraudReq{
		DeviceIntegrityIssue: !deviceIntegrity,
		GpsIpMismatch:        !gpsVerified,
		SpeedUpLocation:      false, // requires heartbeat history
		CrowdsourceMismatch:  !claimClustering,
		TrustScore:           0.9, // TODO: read from users.trust_score
	}

	var resp fraudResp
	if err := mlServiceCall("fraud/score", reqBody, &resp); err != nil {
		log.Printf("⚠️ ML fraud scoring failed (%v), using local fallback", err)
		// Local fallback: simple score from 0 to 1
		score := 0.0
		if !gpsVerified { score += 0.4 }
		if !deviceIntegrity { score += 0.3 }
		if !claimClustering { score += 0.1 }
		return score, nil
	}

	log.Printf("🛡️ ML fraud score for user %s: %d (%s)", userID, resp.FraudScore, resp.Decision)

	// Normalize 0-9 integer score to 0.0-1.0 float for existing threshold check
	normalized := float64(resp.FraudScore) / 9.0
	return normalized, nil
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
