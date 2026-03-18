@echo off
echo Starting parity Microservices...

cd backend

:: Ensure dependencies are completely down loaded
go mod tidy

:: Start all services in the background
start "API Gateway" cmd /k "go run ./services/api-gateway"
start "User Service" cmd /k "go run ./services/user-service"
start "Policy Service" cmd /k "go run ./services/policy-service"
start "Claim Service" cmd /k "go run ./services/claim-service"
start "Notification Service" cmd /k "go run ./services/notification-service"

echo All services are booting up in separate terminal windows!
echo Once done testing, you can just close those command prompt windows.
cd ..
