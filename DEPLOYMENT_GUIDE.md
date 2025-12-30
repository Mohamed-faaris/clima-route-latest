# 🚀 ClimaRoute Production Deployment Guide

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS CLOUD                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Application Load Balancer (ALB)              │  │
│  │                    Port 80/443 (HTTPS)                    │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────────────────┐  │
│  │                   ECS Fargate Cluster                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  Frontend   │  │   Backend   │  │   AI Service    │   │  │
│  │  │   (Nginx)   │  │   (.NET)    │  │   (FastAPI)     │   │  │
│  │  │   Port 80   │  │  Port 5000  │  │   Port 5001     │   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │  │
│  │         │                │                   │            │  │
│  │         │         ┌──────▼──────┐           │            │  │
│  │         └────────►│   Backend   │◄──────────┘            │  │
│  │                   │   handles   │                        │  │
│  │                   │   all API   │                        │  │
│  │                   └──────┬──────┘                        │  │
│  └──────────────────────────┼────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │                    RDS PostgreSQL                         │  │
│  │                   (Production Database)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🏃 Quick Start

### Option 1: Full Docker (Recommended)

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Option 2: Development Mode

```powershell
# Windows PowerShell
.\scripts\start-dev.ps1
```

## 📦 Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 80 | React/Vite app served by Nginx |
| Backend | 5000 | .NET API server |
| AI Service | 5001 | FastAPI weather prediction |
| PostgreSQL | 5432 | Production database |
| Adminer | 8080 | Database GUI (dev only) |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `AI_SERVICE_URL` | AI service endpoint | `http://ai-service:5001` |
| `ASPNETCORE_ENVIRONMENT` | .NET environment | `Production` |

### Health Checks

All services have health check endpoints:

```bash
# AI Service
curl http://localhost:5001/health

# Backend
curl http://localhost:5000/health

# Backend + AI connectivity
curl http://localhost:5000/ready
```

## 🗄️ Database Migration

### From SQLite to PostgreSQL

```bash
# Install dependencies
pip install psycopg2-binary

# Run migration
python scripts/migrate_db.py \
  --sqlite-path ./BACKEND/ClimaRouteAPI/climaroute.db \
  --pg-host localhost \
  --pg-db climaroute \
  --pg-user postgres \
  --pg-password your_password
```

## ☁️ AWS Deployment

### Prerequisites

1. AWS CLI configured
2. Docker installed
3. ECR repositories created

### Deploy to AWS

```bash
# Set environment
export AWS_REGION=ap-south-1

# Deploy
./scripts/deploy-aws.sh production
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| ECS Fargate | Container orchestration |
| ECR | Container registry |
| RDS PostgreSQL | Database |
| Application Load Balancer | Traffic distribution |
| CloudWatch | Logging & monitoring |

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use secrets manager** for production passwords
3. **Enable HTTPS** via ALB or Cloudflare
4. **Restrict security groups** to minimum required ports
5. **Enable RDS encryption** at rest

## 📈 Scaling

### Horizontal Scaling

```yaml
# In docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3
```

### AWS Auto Scaling

- ECS Service Auto Scaling based on CPU/Memory
- Target tracking: 70% CPU utilization
- Min: 1, Max: 10 tasks

## 🐛 Troubleshooting

### AI Service won't start

```bash
# Check logs
docker compose logs ai-service

# Verify model files exist
ls AI_Model/rainfall_model.keras
ls AI_Model/scaler.gz
```

### Database connection failed

```bash
# Check if PostgreSQL is running
docker compose ps db

# Test connection
psql -h localhost -U postgres -d climaroute
```

### Backend can't reach AI service

```bash
# Check network connectivity
docker compose exec backend curl http://ai-service:5001/health
```

## 📋 Maintenance Commands

```bash
# View all logs
docker compose logs -f

# Restart specific service
docker compose restart ai-service

# Rebuild after code changes
docker compose build --no-cache
docker compose up -d

# Clean up everything
docker compose down -v --rmi all
```

## 🎯 Production Checklist

- [ ] Database migrated to PostgreSQL
- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] HTTPS enabled
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Auto-scaling configured
- [ ] Security groups reviewed
