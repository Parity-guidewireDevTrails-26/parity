package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"kavach/pkg/database"
	"kavach/pkg/middleware"
	"kavach/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("⚠️ No .env file found, using environment variables")
	}

	if err := database.InitPostgres(); err != nil {
		log.Fatalf("Failed to initialize PostgreSQL: %v", err)
	}
	defer database.ClosePostgres()

	router := gin.Default()
	router.Use(middleware.RateLimitMiddleware(100))

	router.GET("/api/v1/policies", getPolicies)
	router.POST("/api/v1/policies/subscribe", middleware.AuthMiddleware(), subscribeToPlan)
	router.GET("/api/v1/policies/active", middleware.AuthMiddleware(), getActivePolicy)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "policy-service"})
	})

	port := os.Getenv("POLICY_SERVICE_PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("🚀 Policy Service started on port %s", port)
	router.Run(":" + port)
}

func getPolicies(c *gin.Context) {
	query := `
		SELECT id, name, weekly_premium, coverage_limit, description, is_active
		FROM policies
		WHERE is_active = true
		ORDER BY weekly_premium ASC
	`

	rows, err := database.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch policies"})
		return
	}
	defer rows.Close()

	var policies []models.Policy
	for rows.Next() {
		var policy models.Policy
		if err := rows.Scan(&policy.ID, &policy.Name, &policy.WeeklyPremium, &policy.CoverageLimit, &policy.Description, &policy.IsActive); err != nil {
			continue
		}
		policies = append(policies, policy)
	}

	c.JSON(http.StatusOK, gin.H{"policies": policies})
}

func subscribeToPlan(c *gin.Context) {
	userID := c.GetString("user_id")
	var req models.PolicySubscription
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var policy models.Policy
	policyQuery := `SELECT id, weekly_premium, coverage_limit FROM policies WHERE id = $1 AND is_active = true`
	err := database.DB.QueryRow(policyQuery, req.PolicyID).Scan(&policy.ID, &policy.WeeklyPremium, &policy.CoverageLimit)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Policy not found"})
		return
	}

	startDate := time.Now()
	endDate := startDate.AddDate(0, 0, 7)

	insertQuery := `
		INSERT INTO user_policies (user_id, policy_id, status, start_date, end_date, premium_paid, coverage_limit)
		VALUES ($1, $2, 'active', $3, $4, $5, $6)
		RETURNING id, created_at
	`

	var userPolicyID string
	var createdAt time.Time
	err = database.DB.QueryRow(insertQuery, userID, policy.ID, startDate, endDate, policy.WeeklyPremium, policy.CoverageLimit).
		Scan(&userPolicyID, &createdAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe to policy"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Successfully subscribed to policy",
		"subscription": gin.H{
			"id":             userPolicyID,
			"policy_id":      policy.ID,
			"start_date":     startDate,
			"end_date":       endDate,
			"premium_paid":   policy.WeeklyPremium,
			"coverage_limit": policy.CoverageLimit,
		},
	})
}

func getActivePolicy(c *gin.Context) {
	userID := c.GetString("user_id")

	query := `
		SELECT up.id, up.policy_id, p.name, up.status, up.start_date, up.end_date,
		       up.premium_paid, up.coverage_limit, up.created_at
		FROM user_policies up
		JOIN policies p ON up.policy_id = p.id
		WHERE up.user_id = $1
		AND up.status = 'active'
		AND up.end_date > NOW()
		ORDER BY up.created_at DESC
		LIMIT 1
	`

	var result struct {
		ID            string    `json:"id"`
		PolicyID      string    `json:"policy_id"`
		PolicyName    string    `json:"policy_name"`
		Status        string    `json:"status"`
		StartDate     time.Time `json:"start_date"`
		EndDate       time.Time `json:"end_date"`
		PremiumPaid   float64   `json:"premium_paid"`
		CoverageLimit float64   `json:"coverage_limit"`
		CreatedAt     time.Time `json:"created_at"`
	}

	err := database.DB.QueryRow(query, userID).Scan(
		&result.ID, &result.PolicyID, &result.PolicyName, &result.Status,
		&result.StartDate, &result.EndDate, &result.PremiumPaid,
		&result.CoverageLimit, &result.CreatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active policy found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"active_policy": result})
}
