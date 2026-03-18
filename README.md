# Kavach - AI-Parametric Insurance Platform

A production-ready insurance platform for India's gig economy delivery partners, featuring parametric triggers, fraud detection, and instant payouts.

## Project Structure

```
kavach/
├── backend/                 # Golang microservices
│   ├── services/
│   │   ├── api-gateway/    # Entry point (Port 8080)
│   │   ├── user-service/   # User management (Port 8081)
│   │   ├── policy-service/ # Policy management (Port 8082)
│   │   └── claim-service/  # Claim processing (Port 8083)
│   ├── pkg/
│   │   ├── database/       # PostgreSQL & Redis
│   │   ├── middleware/     # Auth & Rate limiting
│   │   └── models/         # Data models
│   ├── database/           # SQL schema
│   └── examples/           # Sample JSON responses
│
├── app/                    # React Native (Expo)
│   ├── (auth)/            # Login & Register
│   ├── (tabs)/            # Main app screens
│   │   ├── index.tsx      # Dashboard
│   │   ├── policies.tsx   # Policy selection
│   │   ├── claims.tsx     # Claims history
│   │   └── profile.tsx    # User profile
│   └── _layout.tsx
│
├── services/              # API service layer
└── types/                 # TypeScript definitions
```

## Quick Start

### Prerequisites

- **Backend:**
  - Go 1.21+
  - PostgreSQL 14+
  - Redis 7+

- **Frontend:**
  - Node.js 18+
  - npm or yarn
  - Expo CLI

### 1. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Create database
createdb kavach_db

# Run schema migration
psql -U kavach -d kavach_db -f database/schema.sql

# Install Go dependencies
go mod download

# Start API Gateway
cd services/api-gateway && go run main.go &

# Start User Service
cd services/user-service && go run main.go &

# Start Policy Service
cd services/policy-service && go run main.go &

# Start Claim Service
cd services/claim-service && go run main.go claim_processor.go &
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env
nano .env

# Start Expo development server
npm run dev
```

### 3. Access the Application

- **API Gateway:** http://localhost:8080
- **Mobile App:** Scan QR code from Expo Dev Tools
- **API Health:** http://localhost:8080/health

## Architecture Overview

### Backend Microservices

```
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

```
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

## Key Features

### 1. Parametric Triggers

Automatic claim triggering based on real-world conditions:

- **Rainfall:** > 40mm (Flooding risk)
- **Air Quality:** AQI > 500 (Breathing hazard)
- **Traffic:** Speed < 10 km/h (Mobility collapse)
- **Temperature:** > 45°C (Heat wave)

### 2. Hybrid Parametric Model

- **Auto-triggers:** Weather, traffic, pollution events
- **Manual claims:** User-submitted with crowdsourced validation
- **Zero-touch payouts:** No paperwork required

### 3. Fraud Detection

Multi-layered verification:

1. **GPS Matching:** User location vs. event zone
2. **Device Integrity:** Root/jailbreak detection
3. **Claim Clustering:** Cross-validation with other riders

Fraud Score Calculation:
```
fraud_score = 0.0
if gps_mismatch: fraud_score += 0.5
if device_compromised: fraud_score += 0.3
if claim_clustering (3+ users): fraud_score -= 0.2

reject_threshold = 0.7
```

### 4. Income Loss Calculation

```go
// Step 1: Calculate average hourly rate
avg_hourly_rate = AVG(total_earnings / hours_worked) over last 30 days

// Step 2: Determine disruption duration
disruption_hours = min(actual_hours, 8) // Cap at 8 hours

// Step 3: Estimate loss
estimated_loss = avg_hourly_rate × disruption_hours

// Step 4: Apply coverage limit
payout = min(estimated_loss, coverage_limit)
```

### 5. Weekly Pricing Model

| Plan     | Premium | Coverage | Features                    |
|----------|---------|----------|-----------------------------|
| Silver   | ₹45/wk  | ₹1,500   | Basic protection            |
| Gold     | ₹85/wk  | ₹3,500   | Comprehensive coverage      |
| Platinum | ₹150/wk | ₹7,000   | Premium with max protection |

## API Documentation

### Authentication

**Register User**
```bash
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
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone_number": "+919876543210",
  "password": "securepassword"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### Policy Management

**Get Available Policies**
```bash
GET /api/v1/policies

Response:
{
  "policies": [
    {
      "id": "uuid",
      "name": "Gold",
      "weekly_premium": 85.00,
      "coverage_limit": 3500.00,
      "description": "Comprehensive coverage for regular riders"
    }
  ]
}
```

**Subscribe to Policy**
```bash
POST /api/v1/policies/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "policy_id": "uuid"
}
```

### Claim Processing

**Trigger Parametric Event**
```bash
POST /api/v1/events/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_type": "rainfall",
  "zone": "Malviya Nagar",
  "severity": 45.5,
  "threshold": 40.0,
  "probability_score": 0.92,
  "triggered_at": "2024-03-18T14:30:00Z",
  "is_active": true
}
```

**Get User Claims**
```bash
GET /api/v1/claims/user/:user_id
Authorization: Bearer <token>

Response:
{
  "claims": [
    {
      "id": "uuid",
      "claim_type": "auto",
      "status": "paid",
      "estimated_income_loss": 420.00,
      "payout_amount": 420.00,
      "disruption_start": "2024-03-18T14:30:00Z",
      "disruption_end": "2024-03-18T16:45:00Z"
    }
  ]
}
```

## Testing

### Test Parametric Event Flow

```bash
# 1. Register a user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d @backend/examples/register_user.json

# 2. Subscribe to a policy
TOKEN="<your_jwt_token>"
curl -X POST http://localhost:8080/api/v1/policies/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"policy_id": "<policy_uuid>"}'

# 3. Update work zone
curl -X PUT http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"work_zone": "Malviya Nagar"}'

# 4. Trigger parametric event
curl -X POST http://localhost:8080/api/v1/events/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @backend/examples/parametric_event_rainfall.json

# 5. Check claims
curl http://localhost:8080/api/v1/claims/user/<user_id> \
  -H "Authorization: Bearer $TOKEN"
```

## Mobile App Screens

### 1. Dashboard
- Earnings protection meter
- Active policy details
- Zone security status
- Quick stats

### 2. Policy Selection
- Compare plans (Silver, Gold, Platinum)
- One-tap subscription
- Weekly pricing model
- Feature breakdown

### 3. Claims History
- Auto-triggered claims
- Payout details
- Disruption timeline
- Status tracking

### 4. Profile
- Account information
- Work zone setup
- Platform details
- Logout

## Design System

### Color Palette

- **Deep Navy:** `#0A1929` (Background, Trust)
- **Electric Blue:** `#4FC3F7` (Tech, Accent)
- **Safety Orange:** `#FF6B35` (CTA, Visibility)
- **Success Green:** `#4CAF50` (Verified, Positive)
- **Warning Yellow:** `#FFC107` (Pending, Caution)
- **Error Red:** `#F44336` (Rejected, Alert)

### Typography

- **Headings:** 700 weight, 120% line-height
- **Body:** 400-600 weight, 150% line-height
- **Labels:** 14px, 600 weight

## Production Deployment

### Docker Setup

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Environment Variables (Production)

```env
# Database
DB_HOST=your-db-host.rds.amazonaws.com
DB_PORT=5432
DB_USER=kavach
DB_PASSWORD=<secure-password>
DB_NAME=kavach_production

# Redis
REDIS_HOST=your-redis-host.cache.amazonaws.com
REDIS_PORT=6379

# JWT
JWT_SECRET=<generate-secure-random-string>
JWT_EXPIRY=24h

# External APIs
WEATHER_API_KEY=<your-api-key>
TRAFFIC_API_KEY=<your-api-key>
```

## Roadmap

- [ ] External API integrations (Weather, Traffic)
- [ ] Message queue for async processing (Kafka)
- [ ] AI risk prediction models
- [ ] Real-time notification service
- [ ] Admin dashboard for monitoring
- [ ] Analytics and reporting
- [ ] Multi-language support
- [ ] KYC verification flow
- [ ] Payment gateway integration (UPI)
- [ ] Comprehensive test suite

## Contributing

This is a production-ready starter template. Feel free to extend and customize based on your requirements.

## License

MIT License - Free to use and modify

## Support

For questions or issues:
- Backend: See `backend/README.md`
- Frontend: Check React Native/Expo docs
- Database: Refer to `backend/database/schema.sql`

---

