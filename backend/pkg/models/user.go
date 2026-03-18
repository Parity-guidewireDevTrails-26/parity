package models

import "time"

type User struct {
	ID                string    `json:"id"`
	PhoneNumber       string    `json:"phone_number"`
	Name              string    `json:"name"`
	Platform          string    `json:"platform"`
	WorkCity          string    `json:"work_city"`
	WorkZone          string    `json:"work_zone,omitempty"`
	DeviceFingerprint string    `json:"device_fingerprint,omitempty"`
	IsVerified        bool      `json:"is_verified"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type IncomeHistory struct {
	ID                     string    `json:"id"`
	UserID                 string    `json:"user_id"`
	Date                   time.Time `json:"date"`
	DeliveriesCount        int       `json:"deliveries_count"`
	TotalEarnings          float64   `json:"total_earnings"`
	AvgEarningsPerDelivery float64   `json:"avg_earnings_per_delivery"`
	HoursWorked            float64   `json:"hours_worked"`
	CreatedAt              time.Time `json:"created_at"`
}

type UserRegistration struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Platform    string `json:"platform" binding:"required"`
	WorkCity    string `json:"work_city" binding:"required"`
	Password    string `json:"password" binding:"required,min=6"`
}

type UserLogin struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	Password    string `json:"password" binding:"required"`
}
