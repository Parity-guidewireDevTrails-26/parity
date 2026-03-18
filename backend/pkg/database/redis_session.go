package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// RiderSession mirrors services.RiderSession — kept here to avoid circular imports.
// This struct is what gets serialised directly into Redis.
type RiderSession struct {
	UserID        string    `json:"user_id"`
	CurrentZone   string    `json:"current_zone"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
	PrevLatitude  float64   `json:"prev_latitude"`
	PrevLongitude float64   `json:"prev_longitude"`
	LastSeenAt    time.Time `json:"last_seen_at"`
	PrevSeenAt    time.Time `json:"prev_seen_at"`
	DeviceRooted  bool      `json:"device_rooted"`
	IsEmulator    bool      `json:"is_emulator"`
	VPNActive     bool      `json:"vpn_active"`
}

// riderSessionKey returns the Redis key for a given rider.
// Pattern: rider:<userID>
func riderSessionKey(userID string) string {
	return fmt.Sprintf("rider:%s", userID)
}

// UpsertRiderSession writes (or overwrites) a rider's live session to Redis.
// TTL is set to 5 minutes; the mobile app must heartbeat at least every 2 minutes.
func UpsertRiderSession(ctx context.Context, session *RiderSession) error {
	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	return RedisClient.Set(ctx, riderSessionKey(session.UserID), data, 5*time.Minute).Err()
}

// GetRiderSession fetches a rider's live telemetry from Redis.
// Returns an error if the key is missing (TTL expired or rider offline).
func GetRiderSession(ctx context.Context, userID string) (*RiderSession, error) {
	raw, err := RedisClient.Get(ctx, riderSessionKey(userID)).Bytes()
	if err != nil {
		return nil, fmt.Errorf("rider session not found for %s: %w", userID, err)
	}
	var s RiderSession
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

// -----------------------------------------------------------------------
// Redis Schema Documentation (inline for easy discovery)
// -----------------------------------------------------------------------
//
// Key patterns:
//   rider:<userID>          → RiderSession JSON, TTL 5 min
//   zone_risk:<zone>        → zone risk score float, TTL 10 min
//   active_event:<zone>     → ParametricEvent JSON, TTL until resolved_at
//   payout_lock:<claimID>   → "1" with TTL 60 s (idempotency guard)
//
// Speed-up anomaly detection:
//   Each heartbeat stores prev_* fields from the *previous* value before overwriting.
//   The fraud service reads both and computes implied speed via haversine.
//   If implied speed > 80 km/h → penalty added to fraud score.
