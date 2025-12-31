#!/bin/bash

# Clima Route Startup Script

echo "------------------------------------------"
echo "   Clima Route Deployment Orchestrator    "
echo "------------------------------------------"

# Check if .env file exists
if [ -f .env ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️  No .env file found. Using default values or asking for input..."
fi

# 1. Ask for Server URL if not set
if [ -z "$SERVER_URL" ]; then
    read -p "Enter the Server Public IP or Domain (e.g., http://13.233.123.45 or http://localhost): " SERVER_URL
    # Remove trailing slash if any
    SERVER_URL=${SERVER_URL%/}
fi

# 2. Set Environment Variables (override or set defaults)
export HOST_URL="${HOST_URL:-${SERVER_URL}:5000}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-${SERVER_URL},${SERVER_URL}:80,http://localhost,http://localhost:80}"
export BACKEND_PORT="${BACKEND_PORT:-5000}"
export FRONTEND_PORT="${FRONTEND_PORT:-80}"
export AI_SERVICE_PORT="${AI_SERVICE_PORT:-5001}"

# Database defaults
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-climaroute}"
export DB_HOST="${DB_HOST:-db}"
export DB_PORT="${DB_PORT:-5432}"

# Note: Frontend uses relative path /api for Nginx proxy (no need for external URL in Docker)
export VITE_API_URL="${VITE_API_URL:-/api}"

echo ""
echo "🌍 Configuration:"
echo "   - Server URL: $SERVER_URL"
echo "   - Host URL: $HOST_URL"
echo "   - Frontend API: $VITE_API_URL (via Nginx proxy)"
echo "   - Backend Port: $BACKEND_PORT"
echo "   - Frontend Port: $FRONTEND_PORT"
echo "   - AI Service Port: $AI_SERVICE_PORT"
echo "   - Database: PostgreSQL"
echo "   - DB User: $POSTGRES_USER"
echo "   - DB Name: $POSTGRES_DB"
echo "------------------------------------------"

# 3. Start Services
echo "🚀 Starting 3 main services (AI, Backend, Frontend) + Database..."
docker compose up -d --build

# 4. Show Logs
echo ""
echo "✅ Services started successfully!"
echo "📺 Attaching to logs (Press Ctrl+C to exit logs, services will remain running)..."
echo "------------------------------------------"
docker compose logs -f
