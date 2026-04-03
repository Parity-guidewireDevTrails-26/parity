package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitPostgres() error {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// Fallback for local development or direct container setups
		connStr = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"),
		)
	}

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Make sure the users table has expo_push_token
	_, err = DB.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;`)
	if err != nil {
		log.Printf("⚠️ Failed to add expo_push_token column: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)

	log.Println("✅ PostgreSQL connected successfully")
	return nil
}

func ClosePostgres() {
	if DB != nil {
		DB.Close()
		log.Println("PostgreSQL connection closed")
	}
}
