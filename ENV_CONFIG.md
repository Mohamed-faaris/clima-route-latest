# Environment Configuration Guide

This document explains all environment variables used in the Clima Route application.

## Quick Start

1. **Copy the example file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**

   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Run the application:**
   ```bash
   ./start.sh
   ```

## Environment Variables Reference

### Database Configuration

| Variable            | Description              | Default      | Required                    |
| ------------------- | ------------------------ | ------------ | --------------------------- |
| `POSTGRES_USER`     | PostgreSQL username      | `postgres`   | Yes                         |
| `POSTGRES_PASSWORD` | PostgreSQL password      | `postgres`   | Yes (Change in production!) |
| `POSTGRES_DB`       | Database name            | `climaroute` | Yes                         |
| `DB_HOST`           | Database host (internal) | `db`         | Yes                         |
| `DB_PORT`           | Database port            | `5432`       | Yes                         |
| `DATABASE_URL`      | Full Connection String   | (empty)      | No (Overrides above)        |

**Production Security Note:** Always use a strong, unique password for `POSTGRES_PASSWORD` in production!

### External Database (Neon DB, AWS RDS, etc.)

If you want to use an external database like **Neon DB**, you can provide the full connection string in `DATABASE_URL`. This will override the individual `POSTGRES_*` and `DB_*` variables for the backend.

**Neon DB Example:**
```env
DATABASE_URL=Host=ep-cool-darkness-123456.us-east-2.aws.neon.tech;Database=neondb;Username=alex;Password=your_password;SSL Mode=Require
```

**Note:** When using an external database, you can disable the local `db` service in `docker-compose.yml` or simply ignore it. The backend will connect to the URL provided in `DATABASE_URL`.

### Backend API Configuration

| Variable                 | Description                            | Default                                | Required |
| ------------------------ | -------------------------------------- | -------------------------------------- | -------- |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET environment                    | `Production`                           | Yes      |
| `BACKEND_PORT`           | Backend service port                   | `5000`                                 | Yes      |
| `HOST_URL`               | Backend URL (external)                 | `http://localhost:5000`                | Yes      |
| `ALLOWED_ORIGINS`        | CORS allowed origins (comma-separated) | `http://localhost:80,http://localhost` | Yes      |
| `LOG_LEVEL`              | Application log level                  | `Information`                          | No       |
| `ASPNETCORE_LOG_LEVEL`   | ASP.NET Core log level                 | `Warning`                              | No       |

**Example for production:**

```env
HOST_URL=http://your-domain.com:5000
ALLOWED_ORIGINS=http://your-domain.com,http://your-domain.com:80,https://your-domain.com
```

### AI Service Configuration

| Variable          | Description               | Default                                  | Required |
| ----------------- | ------------------------- | ---------------------------------------- | -------- |
| `AI_SERVICE_PORT` | AI service port           | `5001`                                   | Yes      |
| `AI_SERVICE_URL`  | AI service URL (internal) | `http://ai-service:5001`                 | Yes      |
| `MODEL_PATH`      | Path to ML model file     | `/app/rainfall_model.keras`              | Yes      |
| `SCALER_PATH`     | Path to scaler file       | `/app/scaler.gz`                         | Yes      |
| `FLASK_ENV`       | Flask environment         | `production`                             | No       |
| `FLASK_DEBUG`     | Flask debug mode          | `0`                                      | No       |
| `WEATHER_API_URL` | Weather API endpoint      | `https://api.open-meteo.com/v1/forecast` | No       |

### Frontend Configuration

| Variable         | Description           | Default | Required |
| ---------------- | --------------------- | ------- | -------- |
| `FRONTEND_PORT`  | Frontend service port | `80`    | Yes      |
| `VITE_API_URL`   | API URL for frontend  | `/api`  | Yes      |
| `GEMINI_API_KEY` | Google Gemini API key | (empty) | No       |

**Note:** `VITE_API_URL` uses `/api` by default, which is proxied by Nginx to the backend. This simplifies CORS and deployment.

### Development Tools

| Variable       | Description           | Default | Required      |
| -------------- | --------------------- | ------- | ------------- |
| `ADMINER_PORT` | Adminer (DB GUI) port | `8080`  | No (dev only) |

### Deployment Configuration

| Variable               | Description                 | Default            | Required           |
| ---------------------- | --------------------------- | ------------------ | ------------------ |
| `SERVER_URL`           | Server public URL           | `http://localhost` | Yes (for start.sh) |
| `COMPOSE_PROJECT_NAME` | Docker Compose project name | `climaroute`       | No                 |

### Resource Limits

| Variable                  | Description                 | Default | Required |
| ------------------------- | --------------------------- | ------- | -------- |
| `AI_SERVICE_MEMORY_LIMIT` | Memory limit for AI service | `2G`    | No       |
| `BACKEND_MEMORY_LIMIT`    | Memory limit for backend    | `1G`    | No       |

### Security Configuration

| Variable          | Description               | Default                                   | Required |
| ----------------- | ------------------------- | ----------------------------------------- | -------- |
| `JWT_SECRET`      | JWT signing secret        | `default_jwt_secret_change_in_production` | Yes      |
| `SESSION_TIMEOUT` | Session timeout (minutes) | `60`                                      | No       |

**Security Warning:** Change `JWT_SECRET` to a random, secure value in production!

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

### Health Check Configuration

| Variable                | Description           | Default | Required |
| ----------------------- | --------------------- | ------- | -------- |
| `HEALTH_CHECK_INTERVAL` | Health check interval | `30s`   | No       |
| `HEALTH_CHECK_TIMEOUT`  | Health check timeout  | `10s`   | No       |
| `HEALTH_CHECK_RETRIES`  | Health check retries  | `3`     | No       |

## Environment Profiles

### Development Environment

Create a `.env` file for local development:

```env
POSTGRES_PASSWORD=devpassword
ASPNETCORE_ENVIRONMENT=Development
HOST_URL=http://localhost:5000
ALLOWED_ORIGINS=http://localhost:80,http://localhost:3000,http://localhost
FLASK_ENV=development
FLASK_DEBUG=1
LOG_LEVEL=Debug
```

Use the development compose file:

```bash
docker compose -f docker-compose.dev.yml up
```

### Production Environment

Create a `.env` file for production:

```env
# Database - Use strong password!
POSTGRES_PASSWORD=<generate-secure-password>

# Backend
ASPNETCORE_ENVIRONMENT=Production
HOST_URL=http://your-server-ip:5000
ALLOWED_ORIGINS=http://your-server-ip,http://your-server-ip:80

# Security - Generate secure JWT secret!
JWT_SECRET=<generate-secure-jwt-secret>

# Logging
LOG_LEVEL=Warning
ASPNETCORE_LOG_LEVEL=Error

# Resource Limits (adjust based on your server)
AI_SERVICE_MEMORY_LIMIT=2G
BACKEND_MEMORY_LIMIT=1G
```

Run with:

```bash
./start.sh
```

## Docker Compose Integration

All environment variables in `.env` are automatically loaded by Docker Compose. You can:

1. **Use .env file (recommended):**

   ```bash
   docker compose up
   ```

2. **Override with command line:**

   ```bash
   POSTGRES_PASSWORD=mypassword docker compose up
   ```

3. **Use different env file:**
   ```bash
   docker compose --env-file .env.production up
   ```

## Troubleshooting

### Environment variables not loading

Make sure:

- `.env` file is in the same directory as `docker-compose.yml`
- No spaces around `=` in `.env` file
- No quotes needed for values (unless value contains spaces)
- Use `export $(grep -v '^#' .env | xargs)` to test loading

### CORS errors

Check:

- `ALLOWED_ORIGINS` includes your frontend URL
- `HOST_URL` matches your backend URL
- Both HTTP and HTTPS versions if using SSL

### Database connection fails

Verify:

- `POSTGRES_PASSWORD` matches in all places
- Database container is healthy: `docker ps`
- Connection string format is correct

### AI service not working

Ensure:

- Model files exist in `AI_Model/` directory
- `MODEL_PATH` and `SCALER_PATH` are correct
- Sufficient memory allocated (`AI_SERVICE_MEMORY_LIMIT`)

## Best Practices

1. **Never commit `.env` to version control**

   - `.env` is in `.gitignore`
   - Only commit `.env.example`

2. **Use strong passwords in production**

   ```bash
   # Generate secure password
   openssl rand -base64 32
   ```

3. **Rotate secrets regularly**

   - JWT secrets
   - Database passwords
   - API keys

4. **Use environment-specific files**

   - `.env.development`
   - `.env.staging`
   - `.env.production`

5. **Document custom variables**
   - Add to this README
   - Add to `.env.example`

## Support

For issues or questions:

- Check existing documentation
- Review container logs: `docker compose logs`
- Verify environment variables: `docker compose config`
