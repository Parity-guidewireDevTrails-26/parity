package main

import (
	"log"
	"net/http"
	"time"

	"kavach/pkg/database"

	"github.com/gin-gonic/gin"
)

type HeartbeatRequest struct {
	Lat       float64 `json:"lat" binding:"required"`
	Lng       float64 `json:"lng" binding:"required"`
	Timestamp string  `json:"timestamp"`
}

func initHeartbeatTable() {
	query := `
		CREATE TABLE IF NOT EXISTS user_locations (
			id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			lat DOUBLE PRECISION NOT NULL,
			lng DOUBLE PRECISION NOT NULL,
			ip_address VARCHAR(255),
			recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_user_locations_user_time ON user_locations(user_id, recorded_at DESC);
	`
	if _, err := database.DB.Exec(query); err != nil {
		log.Printf("⚠️ Failed to init user_locations table: %v", err)
	}
}

func recordHeartbeat(c *gin.Context) {
	userID := c.GetString("user_id")

	var req HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ipAddress := c.ClientIP()
	recordedAt := time.Now()

	// Parse provided timestamp if any, else use server time
	if req.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, req.Timestamp); err == nil {
			recordedAt = t
		}
	}

	query := `
		INSERT INTO user_locations (user_id, lat, lng, ip_address, recorded_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := database.DB.Exec(query, userID, req.Lat, req.Lng, ipAddress, recordedAt)
	if err != nil {
		log.Printf("Failed to record heartbeat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save heartbeat"})
		return
	}

	// Update user's last_active_at flag for crowdsource mismatch checks
	_, _ = database.DB.Exec(`UPDATE users SET updated_at = NOW() WHERE id = $1`, userID)

	c.JSON(http.StatusOK, gin.H{"message": "Heartbeat recorded"})
}
