# Parity - AI-Parametric Insurance Platform

A production-ready insurance platform for India's gig economy delivery partners, featuring parametric triggers, fraud detection, and instant payouts.

<img width="998" height="497" alt="image" src="https://github.com/user-attachments/assets/9598a6eb-f518-4057-a49f-4913d3579e4c" />

## What is Parity?

Parity is a parametric insurance platform that automatically compensates gig workers when real-world disruptions (rain, traffic, pollution) reduce their earning ability.

- No claims filing  
- No paperwork  
- Instant payouts triggered by real-world data  

**Example:**  
Rainfall > 40mm → System detects disruption → ₹280 credited automatically

## Problem

Gig workers lose income due to:
- Sudden rain
- Traffic collapse
- Extreme heat

- No compensation  
- No safety net  
- No predictable income  

Even 2–3 hours of disruption = significant daily loss

<img width="1085" height="419" alt="image" src="https://github.com/user-attachments/assets/c59894ce-7075-4af4-81b9-7dcb4223cc7a" />

## Why Parametric Insurance?

Traditional insurance:
- Requires manual claims
- Slow payouts
- High fraud risk

Parity:
- Uses real-world data triggers
- Automates claim validation
- Pays instantly without user action

## What Makes Parity Different?

- Zero-touch payouts (no claim filing)
- Real-time trigger detection
- Fraud-resistant via multi-signal validation
- Built specifically for gig economy workflows
- Micro-pricing (weekly, affordable)

## Example Flow

1. Raj starts his delivery shift
2. Heavy rainfall begins (48mm)
3. System detects event in his zone
4. Raj’s activity is verified (GPS + cluster)
5. Estimated loss: ₹280
6. ₹280 credited instantly

No action required from Raj.

## Demo

Watch how Parity works in real-time:
[Demo Video Link]

## Screenshots

<div align="center">
  <img src="https://via.placeholder.com/250x500.png?text=Dashboard+Screen" alt="Dashboard" width="250" />
  <img src="https://via.placeholder.com/250x500.png?text=Policy+Selection" alt="Policy Selection" width="250" />
  <img src="https://via.placeholder.com/250x500.png?text=Claim+Success" alt="Claim Success" width="250" />
</div>

## Architecture Overview

<img width="100%" alt="System Architecture: The Macro View" src="assets/paritysystemdesign.png" />

### Backend Microservices

```text
┌─────────────────────────────────────────────────────────┐
│                      Client Apps                        │
│              (React Native, Web, Mobile)                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   API Gateway :8080                     │
│  • JWT Authentication  • Rate Limiting  • Routing       │
└──────────────┬──────────────┬──────────────┬────────────┘
               │              │              │
     ┌─────────▼────┐  ┌─────▼──────┐  ┌───▼────────┐
     │ User Service │  │   Policy   │  │   Claim    │
     │    :8081     │  │  Service   │  │  Service   │
     │              │  │   :8082    │  │   :8083    │
     └──────┬───────┘  └─────┬──────┘  └─────┬──────┘
            │                │               │
            └────────────────┴───────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
         ┌────▼─────┐              ┌───────▼────┐
         │PostgreSQL│              │   Redis    │
         │          │              │  (Cache)   │
         └──────────┘              └────────────┘
```

### Data Flow - Parametric Event Processing

```text
1. External API Trigger
   └─> Parametric Event (Rainfall > 40mm)
       └─> Claim Service receives event
           └─> Find affected users in zone
               └─> For each user:
                   ├─> Run Fraud Detection
                   │   ├─> GPS Verification
                   │   ├─> Device Integrity Check
                   │   └─> Claim Clustering
                   │
                   ├─> Calculate Income Loss
                   │   └─> avg_hourly_rate × disruption_hours
                   │
                   ├─> Apply Payout Formula
                   │   └─> min(estimated_loss, coverage_limit)
                   │
                   ├─> Create Claim Record
                   │
                   └─> Process Payout
                       └─> Send Notification
```

## Project Structure

```text
parity/
├── backend/                 # Golang microservices
│   ├── services/
│   │   ├── api-gateway/    # Entry point
│   │   ├── user-service/   # User management
│   │   ├── policy-service/ # Policy management
│   │   └── claim-service/  # Claim processing
│   ├── pkg/                # Shared packages
│   └── database/           # SQL schema
│
├── app/                    # React Native (Expo)
│   ├── (auth)/             # Login & Register
│   └── (tabs)/             # Main app screens
│
├── Tie_up/                 # Machine Learning & Core Models
│   ├── data/               # Synthetic datasets
│   ├── models/             # Trained XGBoost models
│   ├── predictor/          # Income loss prediction algorithms
│   ├── insurance/          # Risk, premium, fraud & payout logic
│   ├── generate_dataset.py # Data generation pipeline
│   ├── income.py           # Income calculation
│   └── train.py            # Model training script
```

## Quick Start

### Prerequisites

- **Backend:** Go 1.21+, PostgreSQL 14+, Redis 7+
- **Frontend:** Node.js 18+, npm or yarn, Expo CLI
- **ML/Models:** Python 3.9+, XGBoost, Pandas, Scikit-learn

### 1. Backend Setup

```bash
cd backend
cp .env.example .env

# Create database and run migrations
createdb parity_db
psql -U parity -d parity_db -f database/schema.sql

# Install dependencies and start services
go mod download
go run services/api-gateway/main.go &
go run services/user-service/main.go &
go run services/policy-service/main.go &
go run services/claim-service/main.go &
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start Expo development server
npm run dev
```

## Core Models & Machine Learning

### Solution Architecture
The system follows a modular pipeline:
1. Synthetic data generation based on realistic delivery ecosystem parameters.
2. Machine learning model training to predict income loss.
3. Risk scoring using environmental and operational indicators.
4. Fraud detection through rule-based anomaly identification.
5. Premium calculation using income, risk, and plan-based adjustments.
6. Claim triggering based on predefined environmental thresholds.
7. Payout computation with deductibles, coverage limits, and fraud filtering.
8. Portfolio-level performance analysis.

### Dataset Description
The dataset is synthetically generated to reflect realistic delivery conditions and includes:

| Feature | Description |
|---------|-------------|
| `hours_per_day` | Working hours per day |
| `orders_per_hour` | Delivery throughput |
| `days_per_week` | Weekly work frequency |
| `earnings_per_order` | Earnings per delivery |
| `rainfall_mm` | Rainfall intensity |
| `restaurant_density` | Availability of nearby orders |
| `peak_hour_ratio` | Fraction of work during peak hours |
| `platform_demand_index` | Platform demand indicator |
| `surge_multiplier` | Surge pricing factor |
| `aqi` | Air Quality Index |
| `temperature` | Ambient temperature |
| `expected_income` | Ideal income under normal conditions |
| `actual_income` | Realized income |
| `income_loss` | Difference between expected and actual income |

### Machine Learning Model
- **Model:** XGBoost Regressor
- **Objective:** Predict income loss based on rider and environmental features
- **Input:** Structured tabular data
- **Output:** Continuous income loss value

The model captures non-linear relationships between environmental conditions and earning potential.

### Risk Scoring
Risk is computed as a normalized score in the range `[0, 1]`, based on:
- Rainfall intensity
- AQI levels
- Temperature extremes (Delhi-calibrated thresholds)
- Platform demand index
- Restaurant density
- Peak hour engagement

The scoring function is designed to reflect localized environmental realities, particularly in high-variance urban settings.

### Premium Selection & Calculation
Each rider is assigned a plan option (Silver, Gold, Platinum):

| Plan | Coverage | Loading | Notes |
|------|----------|---------|-------|
| Silver | 50% | Low | Baseline protection |
| Gold | 50% | Medium | Baseline protection with additional benefits |
| Platinum | 55% | High | Higher coverage, controlled insurer exposure |

Premium depends on:
1. Expected weekly income
2. Coverage level (based on plan)
3. Risk score (non-linear scaling)
4. Plan loading

**Formula:**
- `Base Premium = Expected Weekly Income × Coverage`
- `Risk Multiplier = 1 + (Risk ^ 1.5)`
- `Premium = Base Premium × Risk Multiplier × Plan Loading`

### Fraud Detection
A rule-based fraud detection system flags suspicious claims:
- High loss under low-risk conditions
- High claims without environmental triggers
- Extreme loss ratios relative to expected income
- Risk-loss inconsistencies

**Key Checks:**
1. **Rainfall vs Income Loss:** If rainfall is `< 20 mm` but predicted loss is very high.
2. **AQI vs Claim Behavior:** If AQI `< 150` but rider reports high loss.
3. **Temperature-Based Validation:** Flagged if temp is normal `(20–38°C)` but loss is exceptionally high.
4. **Loss-to-Income Ratio Check:** 
   - `loss > 50%` of expected under normal conditions is suspicious.
   - `loss > 90%` of expected is highly suspicious regardless of conditions.
5. **Risk vs Loss Mismatch:** Low risk score coupled with high predicted loss.

**Fraud Scoring:**
- Mild inconsistency → `+1`
- Strong inconsistency → `+2`
- **Final decision:** Fraud if `score >= 3`

### Claim Trigger & Payout Logic
Claims are only valid if external disruption conditions are met (e.g., Rainfall `> 70 mm`, AQI `> 300`, Temp `> 42°C` or `< 10°C`).

**Payout Calculation:**
1. **Check Fraud:** If fraud detected, `Payout = 0`.
2. **Check Trigger:** If no environmental trigger, `Payout = 0`.
3. **Apply Threshold:** Small losses are ignored. `Minimum Loss Threshold = 10% of expected income`.
4. **Apply Deductible:** Rider bears first portion. `Deductible = 10% of expected income`.
5. **Apply Coverage Limit:** Based on plan (50% or 55%).
6. **Final Payout Formula:** `Payout = min(Coverage Limit, Predicted Loss - Deductible)`

## API Standards

- RESTful design
- JSON responses
- Versioned endpoints (/api/v1)

## API Documentation

### Authentication

**Register User**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "phone_number": "+919876543210",
  "name": "Raj Kumar",
  "platform": "Swiggy",
  "work_city": "Delhi",
  "password": "securepassword"
}
```

**Login**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone_number": "+919876543210",
  "password": "securepassword"
}
```

### Claim Processing

**Trigger Parametric Event**
```http
POST /api/v1/events/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_type": "rainfall",
  "zone": "Malviya Nagar",
  "severity": 45.5,
  "threshold": 40.0,
  "triggered_at": "2024-03-18T14:30:00Z"
}
```

## Testing
Test the parametric event flow locally by triggering an auto-claim using curl or postman targeting `http://localhost:8080/api/v1/events/trigger`.

## Observability
- Structured logging across services
- Request tracing via API Gateway
- Health checks for all microservices
- Metrics-ready architecture (Prometheus compatible)

## Security
- JWT-based authentication
- Rate limiting at API Gateway
- Input validation across services
- Fraud detection scoring system
- Secure environment variable handling

## Scalability
- Stateless microservices
- Horizontal scaling supported
- Event-driven architecture (future Kafka integration)
- Redis caching for high-throughput reads

## Future Vision
- Expand to all gig platforms (Uber, Zepto, Blinkit)
- Dynamic pricing based on risk zones
- AI-based disruption prediction
- Embedded insurance APIs for platforms
