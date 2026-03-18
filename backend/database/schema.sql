/*
  # Kavach Insurance Platform - Database Schema

  1. Tables
    - users: Rider profiles and authentication
    - income_history: Historical income tracking
    - policies: Insurance policy plans (Silver, Gold, Platinum)
    - user_policies: Active policy subscriptions
    - claims: Claim records and payouts
    - parametric_events: Disruption triggers (weather, traffic, etc.)
    - zone_risk_scores: Real-time zone risk calculations

  2. Security
    - Proper indexes for performance
    - Foreign key constraints
    - Timestamp tracking for audit
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL, -- Swiggy, Zomato, etc.
    work_city VARCHAR(100) NOT NULL,
    work_zone VARCHAR(100), -- 3-5 km zone identifier
    device_fingerprint TEXT,
    is_verified BOOLEAN DEFAULT false,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Income History Table
CREATE TABLE IF NOT EXISTS income_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    deliveries_count INTEGER NOT NULL,
    total_earnings DECIMAL(10, 2) NOT NULL,
    avg_earnings_per_delivery DECIMAL(10, 2) NOT NULL,
    hours_worked DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Policies Table (Plan Templates)
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL, -- Silver, Gold, Platinum
    weekly_premium DECIMAL(10, 2) NOT NULL,
    coverage_limit DECIMAL(10, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Policies Table (Active Subscriptions)
CREATE TABLE IF NOT EXISTS user_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES policies(id),
    status VARCHAR(20) DEFAULT 'active', -- active, expired, cancelled
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    premium_paid DECIMAL(10, 2) NOT NULL,
    coverage_limit DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parametric Events Table (Disruption Triggers)
CREATE TABLE IF NOT EXISTS parametric_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- rainfall, pollution, traffic, temperature
    zone VARCHAR(100) NOT NULL,
    severity DECIMAL(5, 2) NOT NULL, -- Measured value (40mm, 500 AQI, etc.)
    threshold DECIMAL(5, 2) NOT NULL, -- Trigger threshold
    probability_score DECIMAL(3, 2) NOT NULL, -- 0.0 to 1.0
    triggered_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB, -- Additional event data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Claims Table
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_policy_id UUID NOT NULL REFERENCES user_policies(id),
    event_id UUID REFERENCES parametric_events(id),
    claim_type VARCHAR(50) NOT NULL, -- auto, manual, crowdsourced
    status VARCHAR(20) DEFAULT 'pending', -- pending, verified, paid, rejected
    estimated_income_loss DECIMAL(10, 2) NOT NULL,
    payout_amount DECIMAL(10, 2) NOT NULL,
    fraud_score DECIMAL(3, 2) DEFAULT 0.0, -- 0.0 to 1.0
    gps_verified BOOLEAN DEFAULT false,
    device_verified BOOLEAN DEFAULT false,
    crowdsource_verified BOOLEAN DEFAULT false,
    disruption_start TIMESTAMP NOT NULL,
    disruption_end TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    paid_at TIMESTAMP,
    rejection_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zone Risk Scores Table (Real-time Cache)
CREATE TABLE IF NOT EXISTS zone_risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(100) NOT NULL,
    risk_score DECIMAL(3, 2) NOT NULL, -- 0.0 to 1.0
    contributing_factors JSONB, -- Weather, traffic, pollution data
    calculated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(zone, calculated_at)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_zone ON users(work_zone);
CREATE INDEX IF NOT EXISTS idx_income_user_date ON income_history(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_policies_user ON user_policies(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_policies_dates ON user_policies(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_parametric_zone_active ON parametric_events(zone, is_active, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_user_status ON claims(user_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_event ON claims(event_id);
CREATE INDEX IF NOT EXISTS idx_zone_risk_zone ON zone_risk_scores(zone, calculated_at DESC);

-- Insert Default Policy Plans
INSERT INTO policies (name, weekly_premium, coverage_limit, description, is_active) VALUES
('Silver', 45.00, 1500.00, 'Basic income protection for occasional disruptions', true),
('Gold', 85.00, 3500.00, 'Comprehensive coverage for regular riders', true),
('Platinum', 150.00, 7000.00, 'Premium protection with maximum coverage', true)
ON CONFLICT DO NOTHING;
