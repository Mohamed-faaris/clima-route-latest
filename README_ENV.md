# 🌦️ Clima Route - Environment Configuration Overview

## 📦 What's New: Complete Environment Variable Support

This project now uses **environment variables** for all configuration, making it:

- ✅ **Secure** - No hardcoded credentials
- ✅ **Flexible** - Easy to configure for different environments
- ✅ **Portable** - Same code works everywhere
- ✅ **Production-ready** - Proper security practices

## 🚀 Quick Start (3 Steps)

### Method 1: Interactive Setup (Recommended)

```bash
./setup-env.sh
```

This guided script will:

- Create your `.env` file
- Generate secure passwords and secrets
- Configure network settings
- Validate everything

### Method 2: Manual Setup

```bash
# 1. Copy template
cp .env.example .env

# 2. Edit with your values
nano .env

# 3. Validate
./validate-env.sh

# 4. Start
./start.sh
```

### Method 3: Quick Test (Default Values)

```bash
# Uses the included .env file with default values
docker compose up -d --build
```

## 📁 New Files Reference

| File                           | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| **`.env`**                     | Your environment configuration (don't commit!) |
| **`.env.example`**             | Template with all variables documented         |
| **`setup-env.sh`**             | 🆕 Interactive setup wizard                    |
| **`validate-env.sh`**          | 🆕 Configuration validator                     |
| **`ENV_CONFIG.md`**            | 📖 Complete reference (200+ lines)             |
| **`ENV_QUICK_REF.md`**         | 📋 Quick reference card                        |
| **`MIGRATION_GUIDE.md`**       | 🔄 Migration instructions                      |
| **`ENV_MIGRATION_SUMMARY.md`** | 📊 Change summary                              |

## ⚙️ Key Environment Variables

### Essential (Must Configure)

```bash
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
HOST_URL=http://your-server:5000
ALLOWED_ORIGINS=http://your-server,http://your-server:80
```

### Ports (Can Change if Needed)

```bash
FRONTEND_PORT=80
BACKEND_PORT=5000
AI_SERVICE_PORT=5001
DB_PORT=5432
```

### Environment Type

```bash
ASPNETCORE_ENVIRONMENT=Production  # or Development, Staging
```

See [ENV_CONFIG.md](ENV_CONFIG.md) for complete list (35+ variables).

## 🛠️ Utility Scripts

### 🧙 Interactive Setup

```bash
./setup-env.sh
```

- Guided configuration
- Auto-generates secure passwords
- Validates settings
- Perfect for first-time setup

### ✅ Validation

```bash
./validate-env.sh
```

- Checks required variables
- Validates security settings
- Verifies files exist
- Color-coded output

### 🚀 Deployment

```bash
./start.sh
```

- Loads environment
- Shows configuration summary
- Starts all services
- Attaches to logs

## 🌍 Environment Profiles

### Local Development

```bash
cp .env.example .env
# Edit for development settings
docker compose -f docker-compose.dev.yml up
```

- Includes Adminer (DB GUI) on port 8080
- Hot reload for AI service
- Debug logging enabled

### Production

```bash
./setup-env.sh  # Choose Production mode
./start.sh
```

- Secure defaults
- Minimal logging
- Resource limits applied

## 📖 Documentation

### Quick Start

- **This file** - Overview
- [ENV_QUICK_REF.md](ENV_QUICK_REF.md) - Command cheat sheet

### Detailed Guides

- [ENV_CONFIG.md](ENV_CONFIG.md) - Complete variable reference
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Migrating existing deployments
- [ENV_MIGRATION_SUMMARY.md](ENV_MIGRATION_SUMMARY.md) - What changed

### Deployment Guides

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Production deployment
- [QUICK_START.md](QUICK_START.md) - Getting started
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Initial setup

## 🔒 Security Best Practices

### ⚠️ Never Use Default Passwords in Production!

Generate secure values:

```bash
# Database password
openssl rand -base64 32

# JWT secret
openssl rand -base64 64
```

Or use the interactive setup:

```bash
./setup-env.sh  # Auto-generates secure values
```

### ✅ Checklist for Production

- [ ] Changed `POSTGRES_PASSWORD` from default
- [ ] Set unique `JWT_SECRET`
- [ ] Configured `ALLOWED_ORIGINS` correctly
- [ ] Set `ASPNETCORE_ENVIRONMENT=Production`
- [ ] Verified `.env` is in `.gitignore`
- [ ] Ran `./validate-env.sh` successfully
- [ ] Tested in staging environment first

## 🐛 Troubleshooting

### Configuration Issues

```bash
# Validate your configuration
./validate-env.sh

# Check what Docker Compose will use
docker compose config
```

### Container Issues

```bash
# Check container status
docker ps

# View logs
docker compose logs -f

# Restart specific service
docker compose restart backend
```

### Common Problems

**"Environment variables not loading"**

```bash
# Make sure .env is in the same directory as docker-compose.yml
ls -la .env

# Test loading
export $(grep -v '^#' .env | xargs)
```

**"Database connection failed"**

```bash
# Check password matches
grep POSTGRES_PASSWORD .env

# Wait for database to be ready
docker compose logs db
```

**"CORS errors in browser"**

```bash
# Check ALLOWED_ORIGINS includes your frontend URL
docker compose logs backend | grep -i cors
```

See [ENV_CONFIG.md](ENV_CONFIG.md#troubleshooting) for more solutions.

## 📊 Service URLs

After starting with `./start.sh` or `docker compose up`:

| Service        | URL                     | Description           |
| -------------- | ----------------------- | --------------------- |
| 🌐 Frontend    | `http://localhost:80`   | React web app         |
| 🔧 Backend API | `http://localhost:5000` | .NET API server       |
| 🤖 AI Service  | `http://localhost:5001` | ML prediction service |
| 🗄️ Database    | `localhost:5432`        | PostgreSQL            |
| 🔍 Adminer     | `http://localhost:8080` | DB admin (dev only)   |

Ports are configurable in `.env` file.

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │  Port: 80 (configurable)
│   (React/Vite)  │
└────────┬────────┘
         │
    ┌────▼────────────────┐
    │   Nginx Reverse     │  Proxies /api to backend
    │   Proxy             │
    └────┬────────────────┘
         │
┌────────▼────────┐         ┌──────────────┐
│   Backend       │◄────────┤  PostgreSQL  │
│   (.NET API)    │  Env:   │  Database    │
└────────┬────────┘  Config └──────────────┘
         │
         │
┌────────▼────────┐
│   AI Service    │  ML Model for
│   (Flask)       │  Weather Prediction
└─────────────────┘
```

All services configured via environment variables!

## 🔄 Updating Configuration

### Change a setting

```bash
# 1. Edit .env
nano .env

# 2. Validate
./validate-env.sh

# 3. Restart services
docker compose down
docker compose up -d
```

### Switch environments

```bash
# Development
cp .env.development .env
docker compose -f docker-compose.dev.yml up

# Production
cp .env.production .env
docker compose up -d
```

## 💡 Tips

1. **Use the setup wizard** for first-time configuration:

   ```bash
   ./setup-env.sh
   ```

2. **Always validate** before deploying:

   ```bash
   ./validate-env.sh
   ```

3. **Keep secrets secure** - never commit `.env` to git

4. **Use different configs** for dev/staging/prod

5. **Document custom variables** in team wiki/readme

## 🎯 What's Different?

### Before

```yaml
# Hardcoded in docker-compose.yml
environment:
  POSTGRES_PASSWORD: postgres
  HOST_URL: http://localhost:5000
```

### After

```yaml
# In docker-compose.yml - references .env
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  HOST_URL: ${HOST_URL}
```

```bash
# In .env file
POSTGRES_PASSWORD=my_secure_password
HOST_URL=http://my-server:5000
```

**Result:** Same code, configurable deployment! 🎉

## 📞 Support

- **Documentation:** See [ENV_CONFIG.md](ENV_CONFIG.md)
- **Quick Help:** See [ENV_QUICK_REF.md](ENV_QUICK_REF.md)
- **Migration:** See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- **Issues:** Run `./validate-env.sh` first

## ✨ Summary

You now have:

- ✅ 35+ environment variables for full control
- ✅ Interactive setup wizard (`setup-env.sh`)
- ✅ Configuration validator (`validate-env.sh`)
- ✅ Enhanced deployment script (`start.sh`)
- ✅ Comprehensive documentation (200+ lines)
- ✅ Production-ready security
- ✅ Easy multi-environment support

**Get Started:**

```bash
./setup-env.sh  # Interactive setup
./start.sh      # Deploy!
```

---

Made with ❤️ for better DevOps practices!
