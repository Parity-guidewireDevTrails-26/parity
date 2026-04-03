package main

import (
	"log"
	"net/http"
	"os"

	"kavach/pkg/database"
	"kavach/pkg/middleware"
	"kavach/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if os.Getenv("RAILWAY_ENVIRONMENT") == "" {
		if err := godotenv.Load("../../.env"); err != nil {
			log.Println("⚠️ No .env file found, using environment variables")
		}
	}

	if err := database.InitPostgres(); err != nil {
		log.Fatalf("Failed to initialize PostgreSQL: %v", err)
	}
	defer database.ClosePostgres()

	if err := database.InitRedis(); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer database.CloseRedis()

	router := gin.Default()
	router.Use(middleware.RateLimitMiddleware(100))

	claimProcessor := NewClaimProcessor()

	// ── Phase 2: Seed zones and start real-world API poller ─────────────────
	SeedZoneRiskScoresDB(claimProcessor)
	StartPoller(claimProcessor)

	router.POST("/api/v1/events/trigger", middleware.AuthMiddleware(), func(c *gin.Context) {
		var event models.ParametricEvent
		if err := c.ShouldBindJSON(&event); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := claimProcessor.ProcessParametricEvent(&event); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Event processed successfully",
			"event":   event,
		})
	})

	router.GET("/api/v1/claims/user/:user_id", middleware.AuthMiddleware(), func(c *gin.Context) {
		userID := c.Param("user_id")

		query := `
			SELECT id, user_id, user_policy_id, claim_type, status,
			       estimated_income_loss, payout_amount, fraud_score,
			       disruption_start, disruption_end, created_at
			FROM claims
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT 50
		`

		rows, err := database.DB.Query(query, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var claims []models.Claim
		for rows.Next() {
			var claim models.Claim
			if err := rows.Scan(
				&claim.ID, &claim.UserID, &claim.UserPolicyID, &claim.ClaimType,
				&claim.Status, &claim.EstimatedIncomeLoss, &claim.PayoutAmount,
				&claim.FraudScore, &claim.DisruptionStart, &claim.DisruptionEnd,
				&claim.CreatedAt,
			); err != nil {
				continue
			}
			claims = append(claims, claim)
		}

		c.JSON(http.StatusOK, gin.H{"claims": claims})
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "claim-service"})
	})

	port := os.Getenv("CLAIM_SERVICE_PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("🚀 Claim Service started on port %s", port)
	router.Run(":" + port)
}
