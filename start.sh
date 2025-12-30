#!/bin/bash

# Clima Route Startup Script

echo "------------------------------------------"
echo "   Clima Route Deployment Orchestrator    "
echo "------------------------------------------"

# 1. Ask for Server URL
read -p "Enter the Server Public IP or Domain (e.g., http://13.233.123.45 or http://localhost): " SERVER_URL

# Remove trailing slash if any
SERVER_URL=${SERVER_URL%/}

# 2. Set Environment Variables
export HOST_URL="${SERVER_URL}:5000"
export ALLOWED_ORIGINS="${SERVER_URL},${SERVER_URL}:80,http://localhost,http://localhost:80"

# Note: Frontend uses relative path /api for Nginx proxy (no need for external URL in Docker)

echo ""
echo "🌍 Configuration:"
echo "   - Host URL: $HOST_URL"
echo "   - Frontend API: /api (via Nginx proxy)"
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
