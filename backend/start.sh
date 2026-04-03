#!/bin/bash
echo "🚀 Starting Parity Backend Mono-Deployment..."

# Load env variables if available
if [ -f .env ]; then
  source .env
fi

# Make sure to run `go build` for all services before this script, or use Render's Build Command.
echo "🚦 Launching microservices..."

# Start all services in the background using default layout ports
echo "🚦 Launching microservices..."

export USER_SERVICE_PORT=8081
export POLICY_SERVICE_PORT=8082
export CLAIM_SERVICE_PORT=8083
export NOTIFICATION_SERVICE_PORT=8084
# Render provides the $PORT environment variable, default to 8080 if not set
export API_GATEWAY_PORT=${PORT:-8080}

./bin/user-service &
P1=$!
./bin/policy-service &
P2=$!
./bin/claim-service &
P3=$!
./bin/notification-service &
P4=$!

echo "⏳ Waiting 3 seconds for backend services to initialize..."
sleep 3

# Gateway runs in foreground to keep container alive
echo "🌐 Launching API Gateway on port $API_GATEWAY_PORT"
./bin/api-gateway

# In case the gateway exits, kill background services
kill $P1 $P2 $P3 $P4
