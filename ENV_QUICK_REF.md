# Environment Variables Quick Reference

## Essential Variables (Must Set)

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_secure_jwt_secret

# Network
HOST_URL=http://your-server:5000
ALLOWED_ORIGINS=http://your-server,http://your-server:80
```

## Quick Commands

```bash
# Setup
cp .env.example .env
nano .env

# Validate
./validate-env.sh

# Deploy
./start.sh

# Or manually
docker compose up -d --build
```

## Common Configurations

### Development

```env
POSTGRES_PASSWORD=devpassword
ASPNETCORE_ENVIRONMENT=Development
FLASK_ENV=development
FLASK_DEBUG=1
LOG_LEVEL=Debug
```

### Production

```env
POSTGRES_PASSWORD=<secure>
ASPNETCORE_ENVIRONMENT=Production
JWT_SECRET=<secure>
LOG_LEVEL=Warning
```

## Port Mapping

| Service    | Port | Variable          |
| ---------- | ---- | ----------------- |
| Frontend   | 80   | `FRONTEND_PORT`   |
| Backend    | 5000 | `BACKEND_PORT`    |
| AI Service | 5001 | `AI_SERVICE_PORT` |
| Database   | 5432 | `DB_PORT`         |
| Adminer    | 8080 | `ADMINER_PORT`    |

## Access URLs

```
Frontend:  http://localhost:80
Backend:   http://localhost:5000
AI API:    http://localhost:5001
DB Admin:  http://localhost:8080
```

## Troubleshooting

```bash
# Check if containers are running
docker ps

# View logs
docker compose logs -f

# Validate environment
./validate-env.sh

# Restart services
docker compose restart

# Rebuild from scratch
docker compose down
docker compose up -d --build
```

## Security Checklist

- [ ] Change `POSTGRES_PASSWORD` from default
- [ ] Set unique `JWT_SECRET`
- [ ] Configure `ALLOWED_ORIGINS` correctly
- [ ] Use HTTPS in production (update origins)
- [ ] Never commit `.env` to git
- [ ] Rotate secrets regularly

## Generate Secure Values

```bash
# Database password
openssl rand -base64 32

# JWT secret
openssl rand -base64 64
```

## Documentation

- **Full Reference:** [ENV_CONFIG.md](ENV_CONFIG.md)
- **Migration Guide:** [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- **Template:** [.env.example](.env.example)
