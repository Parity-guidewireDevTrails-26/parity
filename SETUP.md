# Kavach Setup Guide

Complete setup instructions for running Kavach locally.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Testing the Flow](#testing-the-flow)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

**Backend:**
- Go 1.21 or higher
  ```bash
  go version
  ```

- PostgreSQL 14 or higher
  ```bash
  postgres --version
  ```

- Redis 7 or higher
  ```bash
  redis-cli --version
  ```

**Frontend:**
- Node.js 18 or higher
  ```bash
  node --version
  ```

- npm or yarn
  ```bash
  npm --version
  ```

### Installation

**macOS:**
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Go
brew install go

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# Install Redis
brew install redis
brew services start redis

# Install Node.js
brew install node
```

**Ubuntu/Debian:**
```bash
# Install Go
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Install Redis
sudo apt install redis-server
sudo systemctl start redis

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs
```

## Backend Setup

### 1. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=kavach
DB_PASSWORD=kavach_secure_password
DB_NAME=kavach_db

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRY=24h

API_GATEWAY_PORT=8080
USER_SERVICE_PORT=8081
POLICY_SERVICE_PORT=8082
CLAIM_SERVICE_PORT=8083
NOTIFICATION_SERVICE_PORT=8084
```

### 2. Setup Database

```bash
# Create database user
sudo -u postgres psql
postgres=# CREATE USER kavach WITH PASSWORD 'kavach_secure_password';
postgres=# CREATE DATABASE kavach_db;
postgres=# GRANT ALL PRIVILEGES ON DATABASE kavach_db TO kavach;
postgres=# \q

# Run schema migration
psql -U kavach -d kavach_db -f database/schema.sql
```

Verify database setup:
```bash
psql -U kavach -d kavach_db
kavach_db=> \dt
# Should show: users, policies, claims, etc.
kavach_db=> SELECT * FROM policies;
# Should show 3 default policies
kavach_db=> \q
```

### 3. Start Redis

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

### 4. Install Go Dependencies

```bash
cd backend
go mod download
```

### 5. Start Microservices

**Option A: Start services individually (recommended for development)**

Open 4 terminal windows:

**Terminal 1 - API Gateway:**
```bash
cd backend/services/api-gateway
go run main.go
```

**Terminal 2 - User Service:**
```bash
cd backend/services/user-service
go run main.go
```

**Terminal 3 - Policy Service:**
```bash
cd backend/services/policy-service
go run main.go
```

**Terminal 4 - Claim Service:**
```bash
cd backend/services/claim-service
go run main.go claim_processor.go
```

**Terminal 5 - Notification Service (Optional):**
```bash
cd backend/services/notification-service
go run main.go
```

**Option B: Use process manager**

Install goreman:
```bash
go install github.com/mattn/goreman@latest
```

Create `Procfile` in `backend/` directory:
```
gateway: cd services/api-gateway && go run main.go
user: cd services/user-service && go run main.go
policy: cd services/policy-service && go run main.go
claim: cd services/claim-service && go run main.go claim_processor.go
notify: cd services/notification-service && go run main.go
```

Start all services:
```bash
cd backend
goreman start
```

### 6. Verify Backend

```bash
# Check API Gateway
curl http://localhost:8080/health
# Should return: {"service":"api-gateway","status":"healthy","version":"1.0.0"}

# Check User Service
curl http://localhost:8081/health
# Should return: {"service":"user-service","status":"healthy"}

# Check Policy Service
curl http://localhost:8082/health
# Should return: {"service":"policy-service","status":"healthy"}

# Check Claim Service
curl http://localhost:8083/health
# Should return: {"service":"claim-service","status":"healthy"}
```

## Frontend Setup

### 1. Install Dependencies

```bash
# From project root
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:8080
```

### 3. Start Expo Development Server

```bash
npm run dev
```

### 4. Run on Device/Simulator

**iOS Simulator:**
```bash
# Press 'i' in the Expo terminal
```

**Android Emulator:**
```bash
# Press 'a' in the Expo terminal
```

**Physical Device:**
```bash
# Scan QR code with Expo Go app
# iOS: Camera app
# Android: Expo Go app
```

## Testing the Flow

### 1. Register a User

**Via Mobile App:**
1. Open the app
2. Click "Register"
3. Fill in details:
   - Name: Raj Kumar
   - Phone: +919876543210
   - Platform: Swiggy
   - City: Delhi
   - Password: password123
4. Click "Create Account"

**Via API:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919876543210",
    "name": "Raj Kumar",
    "platform": "Swiggy",
    "work_city": "Delhi",
    "password": "password123"
  }'
```

Save the JWT token from response.

### 2. Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919876543210",
    "password": "password123"
  }'
```

### 3. Subscribe to Policy

```bash
TOKEN="your_jwt_token_here"

# Get available policies
curl http://localhost:8080/api/v1/policies

# Subscribe to Gold plan (copy policy_id from response)
curl -X POST http://localhost:8080/api/v1/policies/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "policy_uuid_here"
  }'
```

### 4. Set Work Zone

```bash
curl -X PUT http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_zone": "Malviya Nagar"
  }'
```

### 5. Trigger Parametric Event

```bash
curl -X POST http://localhost:8080/api/v1/events/trigger \
  -H "Authorization: Bearer $TOKEN" \
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

### 6. Check Claims

```bash
# Get user ID from profile
curl http://localhost:8080/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN"

# Get claims
USER_ID="user_uuid_here"
curl http://localhost:8080/api/v1/claims/user/$USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Backend Issues

**Database connection failed:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list                 # macOS

# Check connection
psql -U kavach -d kavach_db -h localhost
```

**Redis connection failed:**
```bash
# Check if Redis is running
redis-cli ping

# If not running
sudo systemctl start redis  # Linux
brew services start redis   # macOS
```

**Port already in use:**
```bash
# Find process using port 8080
lsof -ti:8080

# Kill process
kill -9 $(lsof -ti:8080)
```

**JWT token expired:**
- Re-login to get a new token
- Check JWT_EXPIRY in .env

### Frontend Issues

**Cannot connect to backend:**
- Verify backend services are running
- Check EXPO_PUBLIC_API_URL in .env
- For physical devices, use your machine's IP instead of localhost:
  ```env
  EXPO_PUBLIC_API_URL=http://192.168.1.100:8080
  ```

**Expo not starting:**
```bash
# Clear cache
npx expo start -c

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Build errors:**
```bash
# Type check
npm run typecheck

# Check for missing dependencies
npm install
```

### Database Issues

**Reset database:**
```bash
# Drop and recreate
psql -U kavach -d postgres
postgres=# DROP DATABASE kavach_db;
postgres=# CREATE DATABASE kavach_db;
postgres=# \q

# Re-run migration
psql -U kavach -d kavach_db -f database/schema.sql
```

**Check data:**
```bash
psql -U kavach -d kavach_db

# Check policies
SELECT * FROM policies;

# Check users
SELECT id, name, phone_number, work_zone FROM users;

# Check claims
SELECT id, status, payout_amount FROM claims;
```

## Next Steps

1. **Add Income History:**
   - Insert sample income data for realistic payout calculations
   - Use SQL INSERT or create an admin endpoint

2. **Test Different Scenarios:**
   - High fraud score (GPS mismatch)
   - Multiple users in same zone (clustering)
   - Different policy tiers

3. **Monitor Logs:**
   - Watch service logs for claim processing
   - Check payout calculations

4. **Extend Features:**
   - Add external API integrations
   - Implement real-time notifications
   - Create admin dashboard

## Support

If you encounter issues not covered here:
1. Check service logs for error messages
2. Verify all prerequisites are installed
3. Ensure all services are running
4. Review the main README.md for architecture details

Happy building! 🚀
