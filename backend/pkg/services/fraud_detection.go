package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"
)

// FraudCheckResult holds the outcome of a multi-factor fraud evaluation.
type FraudCheckResult struct {
	UserID          string             `json:"user_id"`
	ClaimID         string             `json:"claim_id"`
	OverallScore    float64            `json:"overall_score"`    // 0.0 = clean, 1.0 = high risk
	IsApproved      bool               `json:"is_approved"`       // false if score > 0.7
	Checks          map[string]float64 `json:"checks"`            // per-signal contribution
	Reason          string             `json:"reason,omitempty"`  // rejection reason if any
	ProcessedAt     time.Time          `json:"processed_at"`
}

// FraudDetector is the interface every concrete fraud engine must satisfy.
// Implementations may call ML models, Redis sessions, or external APIs.
type FraudDetector interface {
	// Evaluate runs the full suite of fraud checks and returns a scored result.
	// A score above 0.7 causes the claim to be flagged/rejected.
	Evaluate(ctx context.Context, req FraudRequest) (*FraudCheckResult, error)

	// CheckGPSMismatch returns a risk penalty (0–0.5) if the rider's live GPS
	// position (stored in Redis) does not match the declared disruption zone.
	CheckGPSMismatch(ctx context.Context, userID, zone string) (float64, error)

	// CheckSpeedAnomaly detects "teleportation" — the rider's last two GPS
	// readings imply a speed physically impossible on Delhi roads.
	// Returns a penalty of 0–0.4 based on implied velocity.
	CheckSpeedAnomaly(ctx context.Context, userID string) (float64, error)

	// CheckDeviceIntegrity inspects the stored device_fingerprint JSON for
	// root/jailbreak flags, emulator signatures, or active VPN usage.
	// Returns a penalty of 0–0.3.
	CheckDeviceIntegrity(ctx context.Context, userID string) (float64, error)

	// CheckClaimClustering reduces the fraud score if >=3 other verified claims
	// have already been processed for the same zone & time window (social proof).
	// Returns a negative penalty of -0.2 (net risk reducer).
	CheckClaimClustering(ctx context.Context, zone string, at time.Time) (float64, error)
}

// FraudRequest carries the minimum context needed for a full fraud evaluation.
type FraudRequest struct {
	UserID    string    `json:"user_id"`
	ClaimID   string    `json:"claim_id"`
	Zone      string    `json:"zone"`
	EventTime time.Time `json:"event_time"`
}

// -----------------------------------------------------------------------
// DefaultFraudDetector — production implementation
// -----------------------------------------------------------------------

// DefaultFraudDetector wires together Redis sessions, the PostgreSQL audit log,
// and device-fingerprint data to compute a composite fraud score.
type DefaultFraudDetector struct {
	// sessionStore is expected to implement RedisSessionStore (see redis.go).
	// Injected via constructor to keep the struct testable.
	sessionStore RedisSessionLookup

	// db exposes the minimal query surface for clustering checks.
	db DBQueryer
}

// RedisSessionLookup is the minimal interface DefaultFraudDetector needs from Redis.
type RedisSessionLookup interface {
	GetRiderSession(ctx context.Context, userID string) (*RiderSession, error)
}

// DBQueryer is the minimal interface DefaultFraudDetector needs from Postgres.
type DBQueryer interface {
	QueryRow(query string, args ...any) DBRow
}

// DBRow mirrors *sql.Row so tests can inject fakes.
type DBRow interface {
	Scan(dest ...any) error
}

// RiderSession contains live telemetry cached in Redis for a single rider.
// Key: rider:<userID>  TTL: 2 minutes (refreshed by the mobile app heartbeat).
type RiderSession struct {
	UserID         string    `json:"user_id"`
	CurrentZone    string    `json:"current_zone"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	PrevLatitude   float64   `json:"prev_latitude"`
	PrevLongitude  float64   `json:"prev_longitude"`
	LastSeenAt     time.Time `json:"last_seen_at"`
	PrevSeenAt     time.Time `json:"prev_seen_at"`
	DeviceRooted   bool      `json:"device_rooted"`
	IsEmulator     bool      `json:"is_emulator"`
	VPNActive      bool      `json:"vpn_active"`
}

// NewDefaultFraudDetector constructs a detector with the supplied dependencies.
func NewDefaultFraudDetector(session RedisSessionLookup, db DBQueryer) *DefaultFraudDetector {
	return &DefaultFraudDetector{sessionStore: session, db: db}
}

// Evaluate satisfies FraudDetector. It runs all signals in sequence, accumulates
// the score, logs every signal for the audit trail, and marks the claim.
func (d *DefaultFraudDetector) Evaluate(ctx context.Context, req FraudRequest) (*FraudCheckResult, error) {
	result := &FraudCheckResult{
		UserID:      req.UserID,
		ClaimID:     req.ClaimID,
		Checks:      make(map[string]float64),
		ProcessedAt: time.Now(),
	}

	total := 0.0

	gps, err := d.CheckGPSMismatch(ctx, req.UserID, req.Zone)
	if err != nil {
		log.Printf("⚠️  [fraud] GPS check error for %s: %v", req.UserID, err)
		gps = 0.3 // conservative penalty on error
	}
	result.Checks["gps_mismatch"] = gps
	total += gps

	speed, err := d.CheckSpeedAnomaly(ctx, req.UserID)
	if err != nil {
		log.Printf("⚠️  [fraud] Speed anomaly check error for %s: %v", req.UserID, err)
		speed = 0.0
	}
	result.Checks["speed_anomaly"] = speed
	total += speed

	device, err := d.CheckDeviceIntegrity(ctx, req.UserID)
	if err != nil {
		log.Printf("⚠️  [fraud] Device integrity check error for %s: %v", req.UserID, err)
		device = 0.0
	}
	result.Checks["device_integrity"] = device
	total += device

	cluster, err := d.CheckClaimClustering(ctx, req.Zone, req.EventTime)
	if err != nil {
		log.Printf("⚠️  [fraud] Clustering check error: %v", err)
		cluster = 0.0
	}
	result.Checks["claim_clustering"] = cluster
	total += cluster

	// Clamp to [0, 1]
	result.OverallScore = math.Max(0, math.Min(1, total))
	result.IsApproved = result.OverallScore <= 0.7

	if !result.IsApproved {
		result.Reason = buildRejectionReason(result.Checks)
	}

	audit, _ := json.Marshal(result)
	log.Printf("🛡️  [fraud] result for claim %s: %s", req.ClaimID, string(audit))

	return result, nil
}

// CheckGPSMismatch compares the rider's live zone (Redis) with the event zone.
func (d *DefaultFraudDetector) CheckGPSMismatch(ctx context.Context, userID, zone string) (float64, error) {
	session, err := d.sessionStore.GetRiderSession(ctx, userID)
	if err != nil {
		return 0.5, fmt.Errorf("session not found: %w", err)
	}
	if session.CurrentZone != zone {
		log.Printf("🔴 [fraud] GPS mismatch: rider %s is in %s, event in %s", userID, session.CurrentZone, zone)
		return 0.5, nil
	}
	return 0.0, nil
}

// CheckSpeedAnomaly detects impossible rider movement between two GPS readings.
func (d *DefaultFraudDetector) CheckSpeedAnomaly(ctx context.Context, userID string) (float64, error) {
	session, err := d.sessionStore.GetRiderSession(ctx, userID)
	if err != nil {
		return 0.0, nil // no session = can't check, pass silently
	}

	dt := session.LastSeenAt.Sub(session.PrevSeenAt).Hours()
	if dt <= 0 {
		return 0.0, nil
	}

	// Haversine distance in km
	dx := haversine(session.PrevLatitude, session.PrevLongitude,
		session.Latitude, session.Longitude)
	speedKmH := dx / dt

	// A delivery bike in Delhi city cannot exceed ~80 km/h in traffic.
	if speedKmH > 80 {
		log.Printf("🔴 [fraud] Speed anomaly: rider %s implied %.0f km/h", userID, speedKmH)
		return 0.4, nil
	}
	return 0.0, nil
}

// CheckDeviceIntegrity looks for root/emulator/VPN flags in the stored session.
func (d *DefaultFraudDetector) CheckDeviceIntegrity(ctx context.Context, userID string) (float64, error) {
	session, err := d.sessionStore.GetRiderSession(ctx, userID)
	if err != nil {
		return 0.0, nil
	}
	if session.DeviceRooted || session.IsEmulator {
		log.Printf("🔴 [fraud] Device integrity fail for rider %s (rooted=%v, emulator=%v)",
			userID, session.DeviceRooted, session.IsEmulator)
		return 0.3, nil
	}
	if session.VPNActive {
		log.Printf("⚠️  [fraud] VPN active for rider %s — minor penalty", userID)
		return 0.15, nil
	}
	return 0.0, nil
}

// CheckClaimClustering returns a social-proof bonus if >=3 claims exist for the zone/window.
func (d *DefaultFraudDetector) CheckClaimClustering(ctx context.Context, zone string, at time.Time) (float64, error) {
	from := at.Add(-1 * time.Hour)
	to := at.Add(1 * time.Hour)

	query := `
		SELECT COUNT(*) FROM claims c
		JOIN parametric_events e ON c.event_id = e.id
		WHERE e.zone = $1 AND e.triggered_at BETWEEN $2 AND $3
		AND c.status IN ('verified','paid')
	`
	var count int
	if err := d.db.QueryRow(query, zone, from, to).Scan(&count); err != nil {
		return 0.0, err
	}
	if count >= 3 {
		log.Printf("✅ [fraud] Clustering bonus: %d verified claims in zone %s", count, zone)
		return -0.2, nil
	}
	return 0.0, nil
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := deg2rad(lat2 - lat1)
	dLon := deg2rad(lon2 - lon1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(deg2rad(lat1))*math.Cos(deg2rad(lat2))*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func deg2rad(d float64) float64 { return d * math.Pi / 180 }

func buildRejectionReason(checks map[string]float64) string {
	var reasons []string
	if checks["gps_mismatch"] >= 0.5 {
		reasons = append(reasons, "GPS location does not match disruption zone")
	}
	if checks["speed_anomaly"] >= 0.4 {
		reasons = append(reasons, "Impossible movement speed detected")
	}
	if checks["device_integrity"] >= 0.3 {
		reasons = append(reasons, "Device integrity check failed (rooted/emulator)")
	}
	if len(reasons) == 0 {
		return "Fraud score threshold exceeded"
	}
	if len(reasons) == 1 {
		return reasons[0]
	}
	result := reasons[0]
	for _, r := range reasons[1:] {
		result += "; " + r
	}
	return result
}
