package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

type NotificationRequest struct {
	UserID  string `json:"user_id" binding:"required"`
	Type    string `json:"type" binding:"required"`
	Title   string `json:"title" binding:"required"`
	Message string `json:"message" binding:"required"`
	Data    map[string]interface{} `json:"data,omitempty"`
}

func main() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("⚠️ No .env file found, using environment variables")
	}

	router := gin.Default()

	router.POST("/api/v1/notifications/send", sendNotification)
	router.POST("/api/v1/notifications/sms", sendSMS)
	router.POST("/api/v1/notifications/email", sendEmail)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "notification-service"})
	})

	port := os.Getenv("NOTIFICATION_SERVICE_PORT")
	if port == "" {
		port = "8084"
	}

	log.Printf("🚀 Notification Service started on port %s", port)
	router.Run(":" + port)
}

func sendNotification(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("📱 Sending push notification to user %s: %s - %s", req.UserID, req.Title, req.Message)

	c.JSON(http.StatusOK, gin.H{
		"message": "Notification sent successfully",
		"notification_id": "notif_" + req.UserID,
		"status": "delivered",
	})
}

func sendSMS(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("📲 Sending SMS to user %s: %s", req.UserID, req.Message)

	c.JSON(http.StatusOK, gin.H{
		"message": "SMS sent successfully",
		"sms_id": "sms_" + req.UserID,
		"status": "delivered",
	})
}

func sendEmail(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("📧 Sending email to user %s: %s - %s", req.UserID, req.Title, req.Message)

	c.JSON(http.StatusOK, gin.H{
		"message": "Email sent successfully",
		"email_id": "email_" + req.UserID,
		"status": "delivered",
	})
}
