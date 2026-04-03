package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"kavach/pkg/database"
	"kavach/pkg/middleware"
	"kavach/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
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

	router := gin.Default()
	router.Use(middleware.RateLimitMiddleware(100))

	router.POST("/api/v1/auth/register", registerUser)
	router.POST("/api/v1/auth/login", loginUser)
	router.GET("/api/v1/users/profile", middleware.AuthMiddleware(), getUserProfile)
	router.PUT("/api/v1/users/profile", middleware.AuthMiddleware(), updateUserProfile)

	// Phase 4: GPS heartbeat for fraud tracking
	initHeartbeatTable()
	router.POST("/api/v1/users/heartbeat", middleware.AuthMiddleware(), recordHeartbeat)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "user-service"})
	})

	port := os.Getenv("USER_SERVICE_PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("🚀 User Service started on port %s", port)
	router.Run(":" + port)
}

// RegisterRequest extends UserRegistration with device fingerprint
type RegisterRequest struct {
	PhoneNumber       string          `json:"phone_number" binding:"required"`
	Name              string          `json:"name" binding:"required"`
	Platform          string          `json:"platform" binding:"required"`
	WorkCity          string          `json:"work_city" binding:"required"`
	Password          string          `json:"password" binding:"required"`
	DeviceFingerprint json.RawMessage `json:"device_fingerprint"`
}

func registerUser(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Serialize device fingerprint to string for storage
	fingerprintJSON := "{}"
	if req.DeviceFingerprint != nil {
		fingerprintJSON = string(req.DeviceFingerprint)
	}

	query := `
		INSERT INTO users (phone_number, name, platform, work_city, password_hash, device_fingerprint, is_verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
		RETURNING id, phone_number, name, platform, work_city, is_verified, created_at
	`

	var user models.User
	err = database.DB.QueryRow(query,
		req.PhoneNumber, req.Name, req.Platform,
		req.WorkCity, string(hashedPassword), fingerprintJSON,
	).Scan(&user.ID, &user.PhoneNumber, &user.Name, &user.Platform,
		&user.WorkCity, &user.IsVerified, &user.CreatedAt)

	if err != nil {
		log.Printf("Register error: %v", err)
		c.JSON(http.StatusConflict, gin.H{"error": "Phone number already registered"})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"token":   token,
		"user":    user,
	})
}

func loginUser(c *gin.Context) {
	var req models.UserLogin
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		SELECT id, phone_number, name, platform, work_city, password_hash, is_verified, created_at
		FROM users
		WHERE phone_number = $1
	`

	var user models.User
	var passwordHash string
	err := database.DB.QueryRow(query, req.PhoneNumber).Scan(
		&user.ID, &user.PhoneNumber, &user.Name, &user.Platform,
		&user.WorkCity, &passwordHash, &user.IsVerified, &user.CreatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.PhoneNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
		"user":    user,
	})
}

func getUserProfile(c *gin.Context) {
	userID := c.GetString("user_id")

	query := `
		SELECT id, phone_number, name, platform, work_city, work_zone,
		       is_verified, device_fingerprint, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user models.User
	var workZone sql.NullString
	var deviceFP sql.NullString
	err := database.DB.QueryRow(query, userID).Scan(
		&user.ID, &user.PhoneNumber, &user.Name, &user.Platform,
		&user.WorkCity, &workZone, &user.IsVerified, &deviceFP,
		&user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if workZone.Valid {
		user.WorkZone = workZone.String
	}
	if deviceFP.Valid {
		user.DeviceFingerprint = deviceFP.String
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func updateUserProfile(c *gin.Context) {
	userID := c.GetString("user_id")

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build dynamic update — only touch provided fields
	setClauses := "updated_at = $1"
	args := []interface{}{time.Now()}
	argIdx := 2

	allowedFields := map[string]string{
		"name":      "name",
		"work_zone": "work_zone",
		"work_city":       "work_city",
		"platform":        "platform",
		"expo_push_token": "expo_push_token",
	}

	for key, col := range allowedFields {
		if val, ok := updates[key]; ok {
			setClauses += ", " + col + " = $" + string(rune('0'+argIdx))
			args = append(args, val)
			argIdx++
		}
	}

	args = append(args, userID)
	query := "UPDATE users SET " + setClauses + " WHERE id = $" + string(rune('0'+argIdx))

	_, err := database.DB.Exec(query, args...)
	if err != nil {
		log.Printf("Update profile error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}
