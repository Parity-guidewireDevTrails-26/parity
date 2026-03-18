# Kavach Backend - Golang Microservices

A production-ready microservices architecture for the Kavach insurance platform, built with Golang for high-performance parametric insurance processing.

## Architecture Overview

```
┌─────────────────┐
│   API Gateway   │ :8080
│  (Entry Point)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐  ┌────────┐  ┌────────────┐
│ User │  │Policy│  │ Claim  │  │Notification│
│:8081 │  │:8082 │  │:8083   │  │  :8084     │
└──┬───┘  └──┬───┘  └───┬────┘  └────────────┘
   │         │          │
   └─────────┴──────────┴─────> PostgreSQL
                                  Redis
```

## Services

### 1. API Gateway (Port 8080)
- Single entry point for all client requests
- JWT authentication
- Rate limiting (200 req/min)
- Request routing to microservices
- Audit logging

### 2. User Service (Port 8081)
- User registration and authentication
- Profile management
- Income history tracking
- Device fingerprinting

**Endpoints:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/users/profile` - Get user profile (Auth required)
- `PUT /api/v1/users/profile` - Update profile (Auth required)

### 3. Policy Service (Port 8082)
- Weekly pricing model
- Plan management (Silver, Gold, Platinum)
- Policy subscriptions
- Coverage calculations

**Endpoints:**
- `GET /api/v1/policies` - List available policies
- `POST /api/v1/policies/subscribe` - Subscribe to plan (Auth required)
- `GET /api/v1/policies/active` - Get active policy (Auth required)

### 4. Claim Processing Service (Port 8083)
- Parametric event monitoring
- Fraud detection pipeline
- Income loss calculation
- Payout processing (min(loss, limit) formula)

**Endpoints:**
- `POST /api/v1/events/trigger` - Trigger parametric event (Auth required)
- `GET /api/v1/claims/user/:user_id` - Get user claims (Auth required)

### 5. Notification Service (Port 8084)
- Real-time push notifications
- SMS alerts
- Email notifications
- Early warning system

## Setup Instructions

### Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Redis 7+

### 1. Environment Configuration

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=kavach
DB_PASSWORD=your_password
DB_NAME=kavach_db

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your_jwt_secret_key
```

### 2. Database Setup

```bash
# Create database
createdb kavach_db

# Run schema migration
psql -U kavach -d kavach_db -f database/schema.sql
```

### 3. Install Dependencies

```bash
go mod download
```

### 4. Start Services

**Option A: Start all services individually**

```bash
# Terminal 1 - API Gateway
cd services/api-gateway
go run main.go

# Terminal 2 - User Service
cd services/user-service
go run main.go

# Terminal 3 - Policy Service
cd services/policy-service
go run main.go

# Terminal 4 - Claim Service
cd services/claim-service
go run main.go claim_processor.go
```

**Option B: Use a process manager (recommended)**

Create a `Procfile`:
```
gateway: cd services/api-gateway && go run main.go
user: cd services/user-service && go run main.go
policy: cd services/policy-service && go run main.go
claim: cd services/claim-service && go run main.go claim_processor.go
```

Then use `goreman` or similar:
```bash
goreman start
```

## Database Schema

### Core Tables

- `users` - Rider profiles and authentication
- `income_history` - Historical income tracking
- `policies` - Insurance policy plans
- `user_policies` - Active subscriptions
- `claims` - Claim records and payouts
- `parametric_events` - Disruption triggers
- `zone_risk_scores` - Real-time zone risk

## Claim Processing Logic

### Payout Calculation

The system uses the formula: `payout = min(estimated_loss, coverage_limit)`

```go
func calculatePayout(estimatedLoss, coverageLimit float64) float64 {
    return math.Min(estimatedLoss, coverageLimit)
}
```

### Income Loss Estimation

```go
// Calculate based on historical average hourly rate
avgHourlyRate = SUM(total_earnings / hours_worked) / 30 days
disruptionHours = min(actual_hours, 8)
estimatedLoss = avgHourlyRate * disruptionHours
```

### Fraud Detection Pipeline

1. **GPS Verification** - Match user location with event zone
2. **Device Integrity** - Check for rooted/jailbroken devices
3. **Claim Clustering** - Verify multiple claims in same zone (crowdsourcing)

Fraud Score Calculation:
- GPS mismatch: +0.5
- Device integrity fail: +0.3
- Claim clustering (3+ users): -0.2
- Threshold: 0.7 (reject if exceeded)

## Testing Parametric Event

### Simulate Rainfall Trigger

```bash
curl -X POST http://localhost:8080/api/v1/events/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "rainfall",
    "zone": "Malviya Nagar",
    "severity": 45.5,
    "threshold": 40.0,
    "probability_score": 0.92,
    "triggered_at": "2024-03-18T14:30:00Z",
    "is_active": true,
    "metadata": {
      "source": "weather_api",
      "station": "Delhi Central"
    }
  }'
```

### Expected Response Flow

1. Event received by Claim Service
2. Find all active users in "Malviya Nagar" zone
3. Run fraud detection for each user
4. Calculate income loss based on historical data
5. Apply payout formula: `min(loss, coverage_limit)`
6. Update claim record with status "verified"
7. Process payout (mock UPI transfer)
8. Send notification to user

## Sample JSON Responses

### Successful Claim Processing

```json
{
  "message": "Event processed successfully",
  "event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "rainfall",
    "zone": "Malviya Nagar",
    "severity": 45.5,
    "threshold": 40.0,
    "probability_score": 0.92,
    "triggered_at": "2024-03-18T14:30:00Z",
    "is_active": true
  },
  "claims_processed": [
    {
      "claim_id": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": "770e8400-e29b-41d4-a716-446655440002",
      "estimated_loss": 420.00,
      "coverage_limit": 3500.00,
      "payout_amount": 420.00,
      "status": "paid",
      "fraud_score": 0.0
    }
  ]
}
```

### Fraud Detection Response

```json
{
  "claim_id": "660e8400-e29b-41d4-a716-446655440003",
  "status": "rejected",
  "rejection_reason": "High fraud score detected",
  "fraud_details": {
    "fraud_score": 0.8,
    "gps_verified": false,
    "device_verified": true,
    "crowdsource_verified": false
  }
}
```

## API Authentication

All protected endpoints require JWT Bearer token:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get token from login/register response:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919876543210",
    "password": "securepassword"
  }'
```

## Monitoring & Health Checks

Each service exposes a health endpoint:

```bash
curl http://localhost:8080/health  # API Gateway
curl http://localhost:8081/health  # User Service
curl http://localhost:8082/health  # Policy Service
curl http://localhost:8083/health  # Claim Service
```

## Production Deployment

### Docker Compose (Recommended)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: kavach_db
      POSTGRES_USER: kavach
      POSTGRES_PASSWORD: secure_password

  redis:
    image: redis:7-alpine

  api-gateway:
    build: ./services/api-gateway
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
```

### Environment Variables for Production

- Use secrets management (AWS Secrets Manager, Vault)
- Enable TLS/SSL for all services
- Configure proper rate limiting
- Set up monitoring (Prometheus + Grafana)
- Enable structured logging (JSON format)

## Next Steps

1. Add external API integrations (Weather, Traffic)
2. Implement message queue (Kafka/RabbitMQ)
3. Add AI risk prediction models
4. Set up CI/CD pipeline
5. Implement comprehensive testing suite
6. Add API documentation (Swagger/OpenAPI)

## Support

For issues or questions, contact the development team.
