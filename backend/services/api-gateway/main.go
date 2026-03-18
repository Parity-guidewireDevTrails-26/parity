package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"kavach/pkg/database"
	"kavach/pkg/middleware"

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
	router.Use(middleware.RateLimitMiddleware(200))

	userServiceURL, _ := url.Parse("http://localhost:" + getEnv("USER_SERVICE_PORT", "8081"))
	policyServiceURL, _ := url.Parse("http://localhost:" + getEnv("POLICY_SERVICE_PORT", "8082"))
	claimServiceURL, _ := url.Parse("http://localhost:" + getEnv("CLAIM_SERVICE_PORT", "8083"))

	router.Any("/api/v1/auth/*path", reverseProxy(userServiceURL))
	router.Any("/api/v1/users/*path", reverseProxy(userServiceURL))
	router.Any("/api/v1/policies/*path", reverseProxy(policyServiceURL))
	router.Any("/api/v1/claims/*path", reverseProxy(claimServiceURL))
	router.Any("/api/v1/events/*path", reverseProxy(claimServiceURL))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "api-gateway",
			"version": "1.0.0",
		})
	})

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Kavach API Gateway",
			"version": "1.0.0",
			"services": map[string]string{
				"user":   "/api/v1/users",
				"policy": "/api/v1/policies",
				"claim":  "/api/v1/claims",
			},
		})
	})

	port := getEnv("API_GATEWAY_PORT", "8080")
	log.Printf("🚀 API Gateway started on port %s", port)
	log.Println("📡 Routing requests to microservices...")
	router.Run(":" + port)
}

func reverseProxy(target *url.URL) gin.HandlerFunc {
	proxy := httputil.NewSingleHostReverseProxy(target)

	return func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
