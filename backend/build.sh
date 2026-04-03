#!/bin/bash
echo "📦 Building all Go microservices..."

go build -o bin/user-service ./services/user-service/*.go
go build -o bin/policy-service ./services/policy-service/*.go
go build -o bin/claim-service ./services/claim-service/*.go
go build -o bin/notification-service ./services/notification-service/*.go
go build -o bin/api-gateway ./services/api-gateway/*.go

echo "✅ Build complete."
