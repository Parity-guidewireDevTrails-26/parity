package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"kavach/pkg/database"
	"kavach/pkg/middleware"
	"kavach/pkg/models"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
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

	router.POST("/api/v1/auth/register", registerUser)
	router.POST("/api/v1/auth/login", loginUser)
	router.GET("/api/v1/users/profile", middleware.AuthMiddleware(), getUserProfile)
	router.PUT("/api/v1/users/profile", middleware.AuthMiddleware(), updateUserProfile)

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

func registerUser(c *gin.Context) {
	var req models.UserRegistration
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	query := `
		INSERT INTO users (phone_number, name, platform, work_city, password_hash)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, phone_number, name, platform, work_city, created_at
	`

	var user models.User
	err = database.DB.QueryRow(query, req.PhoneNumber, req.Name, req.Platform, req.WorkCity, hashedPassword).
		Scan(&user.ID, &user.PhoneNumber, &user.Name, &user.Platform, &user.WorkCity, &user.CreatedAt)

	if err != nil {
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
		SELECT id, phone_number, name, platform, work_city, password_hash, created_at
		FROM users
		WHERE phone_number = $1
	`

	var user models.User
	var passwordHash string
	err := database.DB.QueryRow(query, req.PhoneNumber).Scan(
		&user.ID, &user.PhoneNumber, &user.Name, &user.Platform,
		&user.WorkCity, &passwordHash, &user.CreatedAt,
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
		       is_verified, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user models.User
	var workZone sql.NullString
	err := database.DB.QueryRow(query, userID).Scan(
		&user.ID, &user.PhoneNumber, &user.Name, &user.Platform,
		&user.WorkCity, &workZone, &user.IsVerified, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if workZone.Valid {
		user.WorkZone = workZone.String
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

	if workZone, ok := updates["work_zone"].(string); ok {
		query := `UPDATE users SET work_zone = $1, updated_at = NOW() WHERE id = $2`
		_, err := database.DB.Exec(query, workZone, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}
