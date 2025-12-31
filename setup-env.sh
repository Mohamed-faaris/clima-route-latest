#!/bin/bash

# Quick Setup Script for Clima Route
# This script helps you quickly set up the environment

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   Clima Route - Environment Setup        ║"
echo "╔══════════════════════════════════════════╗"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled. Existing .env file kept."
        exit 0
    fi
    echo "📝 Backing up existing .env to .env.backup"
    cp .env .env.backup
fi

# Copy template
echo "📄 Creating .env from template..."
cp .env.example .env

echo ""
echo "Now, let's configure your environment..."
echo ""

# Prompt for essential values
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Security Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Database Password
echo ""
echo "1️⃣  Database Password"
echo "   (Leave empty to generate a random secure password)"
read -p "Enter PostgreSQL password: " -s DB_PASS
echo ""

if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    echo "   ✅ Generated secure password"
fi

# Update .env
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASS/" .env

# JWT Secret
echo ""
echo "2️⃣  JWT Secret"
echo "   (Leave empty to generate a random secure secret)"
read -p "Enter JWT secret: " -s JWT_SEC
echo ""

if [ -z "$JWT_SEC" ]; then
    JWT_SEC=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-40)
    echo "   ✅ Generated secure JWT secret"
fi

# Update .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SEC/" .env

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Network Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Environment
echo ""
echo "3️⃣  Environment"
echo "   1) Production"
echo "   2) Development"
echo "   3) Staging"
read -p "Select environment (1-3) [1]: " ENV_CHOICE

case $ENV_CHOICE in
    2)
        ASPNET_ENV="Development"
        FLASK_ENV="development"
        FLASK_DEBUG="1"
        LOG_LEVEL="Debug"
        ;;
    3)
        ASPNET_ENV="Staging"
        FLASK_ENV="production"
        FLASK_DEBUG="0"
        LOG_LEVEL="Information"
        ;;
    *)
        ASPNET_ENV="Production"
        FLASK_ENV="production"
        FLASK_DEBUG="0"
        LOG_LEVEL="Warning"
        ;;
esac

sed -i "s/ASPNETCORE_ENVIRONMENT=.*/ASPNETCORE_ENVIRONMENT=$ASPNET_ENV/" .env
sed -i "s/FLASK_ENV=.*/FLASK_ENV=$FLASK_ENV/" .env
sed -i "s/FLASK_DEBUG=.*/FLASK_DEBUG=$FLASK_DEBUG/" .env
sed -i "s/LOG_LEVEL=.*/LOG_LEVEL=$LOG_LEVEL/" .env

echo "   ✅ Environment set to: $ASPNET_ENV"

# Server URL
echo ""
echo "4️⃣  Server URL"
echo "   Examples:"
echo "   - http://localhost (for local)"
echo "   - http://192.168.1.100 (for LAN)"
echo "   - http://your-domain.com (for production)"
read -p "Enter server URL [http://localhost]: " SERVER

if [ -z "$SERVER" ]; then
    SERVER="http://localhost"
fi

# Remove trailing slash
SERVER=${SERVER%/}

# Update .env
sed -i "s|SERVER_URL=.*|SERVER_URL=$SERVER|" .env
sed -i "s|HOST_URL=.*|HOST_URL=$SERVER:5000|" .env
sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$SERVER,$SERVER:80,http://localhost,http://localhost:80|" .env

echo "   ✅ Server URL set to: $SERVER"

# Optional: Gemini API Key
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Optional Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "5️⃣  Gemini API Key (optional - for AI features)"
read -p "Enter Gemini API key (or leave empty to skip): " GEMINI_KEY

if [ ! -z "$GEMINI_KEY" ]; then
    sed -i "s/GEMINI_API_KEY=.*/GEMINI_API_KEY=$GEMINI_KEY/" .env
    echo "   ✅ Gemini API key configured"
else
    echo "   ⏭️  Skipped"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuration Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Configuration Summary:"
echo "   - Environment: $ASPNET_ENV"
echo "   - Server URL: $SERVER"
echo "   - Backend: $SERVER:5000"
echo "   - Frontend: $SERVER:80"
echo "   - Database: PostgreSQL with secure password"
echo "   - JWT: Configured with secure secret"
echo ""

# Validate
echo "Validating configuration..."
if [ -f validate-env.sh ]; then
    chmod +x validate-env.sh
    ./validate-env.sh
else
    echo "⚠️  validate-env.sh not found, skipping validation"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Review your configuration:"
echo "   cat .env"
echo ""
echo "2. Start the application:"
echo "   ./start.sh"
echo "   or"
echo "   docker compose up -d --build"
echo ""
echo "3. Access the application:"
echo "   Frontend: $SERVER:80"
echo "   Backend:  $SERVER:5000"
echo "   DB Admin: $SERVER:8080 (dev mode)"
echo ""
echo "4. View logs:"
echo "   docker compose logs -f"
echo ""
echo "📖 For more information, see:"
echo "   - ENV_CONFIG.md (detailed reference)"
echo "   - ENV_QUICK_REF.md (quick reference)"
echo "   - MIGRATION_GUIDE.md (migration guide)"
echo ""
