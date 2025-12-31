#!/bin/bash

# Clima Route Health Monitor
# Shows detailed health status of all services

echo "╔════════════════════════════════════════════════╗"
echo "║     Clima Route - Health Monitor              ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local container=$1
    local name=$2
    
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        local status=$(docker inspect $container --format='{{.State.Health.Status}}' 2>/dev/null)
        local running=$(docker inspect $container --format='{{.State.Status}}')
        
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}$name${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -n "Container: "
        if [ "$running" == "running" ]; then
            echo -e "${GREEN}Running${NC}"
        else
            echo -e "${RED}$running${NC}"
        fi
        
        echo -n "Health: "
        if [ "$status" == "healthy" ]; then
            echo -e "${GREEN}✓ Healthy${NC}"
        elif [ "$status" == "unhealthy" ]; then
            echo -e "${RED}✗ Unhealthy${NC}"
        elif [ "$status" == "starting" ]; then
            echo -e "${YELLOW}⏳ Starting${NC}"
        elif [ -z "$status" ]; then
            echo -e "${YELLOW}⚠ No health check${NC}"
        else
            echo -e "${YELLOW}$status${NC}"
        fi
        
        # Show last health check output
        if [ ! -z "$status" ] && [ "$status" != "" ]; then
            echo -n "Last Check: "
            local last_check=$(docker inspect $container --format='{{(index .State.Health.Log 0).Output}}' 2>/dev/null | head -c 200)
            if [ ! -z "$last_check" ]; then
                echo "$last_check" | tr '\n' ' '
                echo ""
            else
                echo "N/A"
            fi
        fi
        
        echo ""
    else
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}$name${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}✗ Container not found${NC}"
        echo ""
    fi
}

# Check all services
check_service "climaroute-db" "📦 Database (PostgreSQL)"
check_service "climaroute-ai" "🤖 AI Service (Flask)"
check_service "climaroute-backend" "🔧 Backend (.NET API)"
check_service "climaroute-frontend" "🌐 Frontend (Nginx)"

# Overall status
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Overall Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Count healthy services
healthy_count=$(docker ps --format '{{.Names}}' | grep climaroute | xargs -I {} docker inspect {} --format='{{.State.Health.Status}}' 2>/dev/null | grep -c "healthy")
total_count=$(docker ps --format '{{.Names}}' | grep -c climaroute)

echo "Services: $healthy_count/$total_count healthy"

# Quick API test
echo ""
echo "Quick API Test:"
if curl -s http://localhost:80/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API accessible at http://localhost:80/api/"
else
    echo -e "  ${RED}✗${NC} API not accessible"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════"
