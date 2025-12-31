# Migration Guide: Moving to Environment Variables

This guide helps you migrate from hardcoded configuration to environment-based configuration.

## Quick Migration Steps

### 1. Create Your Environment File

```bash
# Copy the example file
cp .env.example .env

# Edit with your current values
nano .env
```

### 2. Update Your Configuration

For existing deployments, here's what changed:

#### Before (Hardcoded):

```yaml
# docker-compose.yml
environment:
  POSTGRES_PASSWORD: postgres
  ASPNETCORE_ENVIRONMENT: Production
```

#### After (Using .env):

```yaml
# docker-compose.yml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
  ASPNETCORE_ENVIRONMENT: ${ASPNETCORE_ENVIRONMENT:-Production}
```

```bash
# .env file
POSTGRES_PASSWORD=your_secure_password
ASPNETCORE_ENVIRONMENT=Production
```

### 3. Validate Configuration

```bash
# Run the validation script
./validate-env.sh
```

### 4. Restart Services

```bash
# Stop existing containers
docker compose down

# Start with new configuration
./start.sh
# or
docker compose up -d --build
```

## What Changed?

### Database Configuration

**Before:**

- Hardcoded in `docker-compose.yml`
- Password: `postgres` or `devpassword`

**After:**

- Set in `.env` file
- Variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DB_HOST`, `DB_PORT`

### Backend Configuration

**Before:**

- Hardcoded in `appsettings.Production.json`
- Connection string: `Host=db;Database=climaroute;Username=postgres;Password=postgres`
- AI URL: `http://ai-service:5001`

**After:**

- Set via environment variables in docker-compose
- Variables: `ASPNETCORE_ENVIRONMENT`, `HOST_URL`, `ALLOWED_ORIGINS`, `AI_SERVICE_URL`
- Connection string built from: `DB_HOST`, `DB_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

### Frontend Configuration

**Before:**

- Hardcoded build arg: `VITE_API_URL=http://3.238.234.41/api`

**After:**

- Set in `.env` file
- Variable: `VITE_API_URL` (default: `/api`)

### AI Service Configuration

**Before:**

- Hardcoded paths in `app.py`
- Weather API URL hardcoded

**After:**

- Variables: `MODEL_PATH`, `SCALER_PATH`, `WEATHER_API_URL`, `FLASK_ENV`

## Migration Checklist

- [ ] Create `.env` file from `.env.example`
- [ ] Set `POSTGRES_PASSWORD` (use strong password for production)
- [ ] Set `JWT_SECRET` (generate secure random string)
- [ ] Set `HOST_URL` to your server's public URL
- [ ] Set `ALLOWED_ORIGINS` to include your frontend URLs
- [ ] Set `SERVER_URL` for the start.sh script
- [ ] Validate configuration with `./validate-env.sh`
- [ ] Backup existing data (if any)
- [ ] Stop old containers: `docker compose down`
- [ ] Pull/rebuild images: `docker compose pull && docker compose build`
- [ ] Start with new config: `./start.sh`
- [ ] Verify all services are healthy: `docker ps`
- [ ] Test application access
- [ ] Check logs: `docker compose logs`

## Environment-Specific Configurations

### Local Development

```bash
# .env
POSTGRES_PASSWORD=devpassword
ASPNETCORE_ENVIRONMENT=Development
HOST_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:80,http://localhost:3000,http://localhost
FLASK_ENV=development
FLASK_DEBUG=1
LOG_LEVEL=Debug

# Use development compose file
docker compose -f docker-compose.dev.yml up
```

### Staging Server

```bash
# .env
POSTGRES_PASSWORD=<secure-staging-password>
ASPNETCORE_ENVIRONMENT=Staging
HOST_URL=http://staging.yourdomain.com:5000
ALLOWED_ORIGINS=http://staging.yourdomain.com,http://staging.yourdomain.com:80
JWT_SECRET=<staging-jwt-secret>
LOG_LEVEL=Information
```

### Production Server

```bash
# .env
POSTGRES_PASSWORD=<secure-production-password>
ASPNETCORE_ENVIRONMENT=Production
HOST_URL=http://yourdomain.com:5000
ALLOWED_ORIGINS=http://yourdomain.com,http://yourdomain.com:80,https://yourdomain.com
JWT_SECRET=<production-jwt-secret>
LOG_LEVEL=Warning
ASPNETCORE_LOG_LEVEL=Error
AI_SERVICE_MEMORY_LIMIT=2G
```

## Security Improvements

### Generate Secure Passwords

```bash
# Generate secure database password
openssl rand -base64 32

# Generate secure JWT secret
openssl rand -base64 64
```

### Update .env File

```bash
# Add to .env
POSTGRES_PASSWORD=<generated-password>
JWT_SECRET=<generated-secret>
```

## Troubleshooting

### "Environment variables not loaded"

**Solution:**

```bash
# Verify .env file exists
ls -la .env

# Check docker compose can read it
docker compose config

# Manually export for testing
export $(grep -v '^#' .env | xargs)
```

### "Database connection failed"

**Solution:**

```bash
# Check password matches everywhere
grep POSTGRES_PASSWORD .env

# Verify connection string format
docker compose config | grep ConnectionStrings
```

### "CORS errors in browser"

**Solution:**

```bash
# Ensure frontend URL is in ALLOWED_ORIGINS
# Example for IP 13.233.123.45:
ALLOWED_ORIGINS=http://13.233.123.45,http://13.233.123.45:80,http://localhost
```

### "AI service not starting"

**Solution:**

```bash
# Check model files exist
ls -lh AI_Model/*.keras AI_Model/*.gz

# Check memory limits
docker stats climaroute-ai

# Increase memory if needed in .env
AI_SERVICE_MEMORY_LIMIT=4G
```

## Rollback Procedure

If you need to rollback to hardcoded configuration:

1. **Backup current .env:**

   ```bash
   cp .env .env.backup
   ```

2. **Checkout previous commit:**

   ```bash
   git log --oneline
   git checkout <previous-commit-hash>
   ```

3. **Rebuild:**
   ```bash
   docker compose down
   docker compose up -d --build
   ```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
env:
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  HOST_URL: ${{ secrets.HOST_URL }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
variables:
  POSTGRES_PASSWORD: $POSTGRES_PASSWORD
  JWT_SECRET: $JWT_SECRET
```

## Additional Resources

- [ENV_CONFIG.md](ENV_CONFIG.md) - Complete environment variable reference
- [.env.example](.env.example) - Template with all variables
- [validate-env.sh](validate-env.sh) - Configuration validation script
- [start.sh](start.sh) - Deployment orchestration script

## Need Help?

1. Run validation: `./validate-env.sh`
2. Check logs: `docker compose logs`
3. Verify config: `docker compose config`
4. Review documentation: `ENV_CONFIG.md`
