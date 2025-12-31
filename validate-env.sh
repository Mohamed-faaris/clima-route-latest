#!/bin/bash

# Environment Configuration Validator for Clima Route

echo "=========================================="
echo "  Clima Route Environment Validator"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file found"
    source .env
else
    echo -e "${RED}✗${NC} .env file not found"
    echo -e "${YELLOW}→${NC} Run: cp .env.example .env"
    exit 1
fi

echo ""
echo "Checking required variables..."
echo ""

# Function to check variable
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local is_required=$2
    local default_value=$3
    
    if [ -z "$var_value" ]; then
        if [ "$is_required" = "true" ]; then
            echo -e "${RED}✗${NC} $var_name: NOT SET (required)"
            return 1
        else
            echo -e "${YELLOW}!${NC} $var_name: Not set (using default: $default_value)"
            return 0
        fi
    else
        # Check for insecure defaults in production
        if [ "$ASPNETCORE_ENVIRONMENT" = "Production" ]; then
            if [ "$var_name" = "POSTGRES_PASSWORD" ] && [ "$var_value" = "postgres" ]; then
                echo -e "${RED}✗${NC} $var_name: Using default password (INSECURE for production!)"
                return 1
            fi
            if [ "$var_name" = "JWT_SECRET" ] && [[ "$var_value" == *"default"* ]]; then
                echo -e "${RED}✗${NC} $var_name: Using default secret (INSECURE for production!)"
                return 1
            fi
        fi
        echo -e "${GREEN}✓${NC} $var_name: $var_value"
        return 0
    fi
}

# Track errors
ERRORS=0

# Database Configuration
echo "📦 Database Configuration:"
check_var "POSTGRES_USER" true || ((ERRORS++))
check_var "POSTGRES_PASSWORD" true || ((ERRORS++))
check_var "POSTGRES_DB" true || ((ERRORS++))
check_var "DB_HOST" false "db"
check_var "DB_PORT" false "5432"
echo ""

# Backend Configuration
echo "🔧 Backend Configuration:"
check_var "ASPNETCORE_ENVIRONMENT" false "Production"
check_var "BACKEND_PORT" false "5000"
check_var "HOST_URL" false "http://localhost:5000"
check_var "ALLOWED_ORIGINS" true || ((ERRORS++))
echo ""

# AI Service Configuration
echo "🤖 AI Service Configuration:"
check_var "AI_SERVICE_PORT" false "5001"
check_var "AI_SERVICE_URL" false "http://ai-service:5001"
check_var "MODEL_PATH" false "/app/rainfall_model.keras"
check_var "SCALER_PATH" false "/app/scaler.gz"
echo ""

# Frontend Configuration
echo "🌐 Frontend Configuration:"
check_var "FRONTEND_PORT" false "80"
check_var "VITE_API_URL" false "/api"
echo ""

# Security Configuration
echo "🔒 Security Configuration:"
check_var "JWT_SECRET" true || ((ERRORS++))
check_var "SESSION_TIMEOUT" false "60"
echo ""

# Check for model files
echo "Checking required files..."
echo ""
if [ -f "AI_Model/rainfall_model.keras" ]; then
    echo -e "${GREEN}✓${NC} AI Model file found"
else
    echo -e "${RED}✗${NC} AI Model file not found: AI_Model/rainfall_model.keras"
    ((ERRORS++))
fi

if [ -f "AI_Model/scaler.gz" ]; then
    echo -e "${GREEN}✓${NC} Scaler file found"
else
    echo -e "${RED}✗${NC} Scaler file not found: AI_Model/scaler.gz"
    ((ERRORS++))
fi

echo ""
echo "=========================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Configuration is valid!${NC}"
    echo ""
    echo "You can now start the application with:"
    echo "  ./start.sh"
    echo "or"
    echo "  docker compose up -d"
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS error(s) in configuration${NC}"
    echo ""
    echo "Please fix the errors above before starting the application."
    echo "See ENV_CONFIG.md for detailed documentation."
    exit 1
fi
