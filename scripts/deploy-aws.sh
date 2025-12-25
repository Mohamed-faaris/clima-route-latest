#!/bin/bash
# ============================================
# AWS ECS Deployment Script
# ============================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ENVIRONMENT="${1:-production}"

echo "============================================"
echo "🚀 Deploying ClimaRoute to AWS ECS"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"
echo "============================================"

# 1. Login to ECR
echo "📦 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BASE

# 2. Build and push AI Service
echo "🤖 Building AI Service..."
docker build -t climaroute-ai-$ENVIRONMENT ./AI_Model
docker tag climaroute-ai-$ENVIRONMENT:latest $ECR_BASE/climaroute-ai-$ENVIRONMENT:latest
docker push $ECR_BASE/climaroute-ai-$ENVIRONMENT:latest

# 3. Build and push Backend
echo "⚙️ Building Backend..."
docker build -t climaroute-backend-$ENVIRONMENT ./BACKEND
docker tag climaroute-backend-$ENVIRONMENT:latest $ECR_BASE/climaroute-backend-$ENVIRONMENT:latest
docker push $ECR_BASE/climaroute-backend-$ENVIRONMENT:latest

# 4. Build and push Frontend
echo "🌐 Building Frontend..."
docker build -t climaroute-frontend-$ENVIRONMENT "./climaroute FRONT END"
docker tag climaroute-frontend-$ENVIRONMENT:latest $ECR_BASE/climaroute-frontend-$ENVIRONMENT:latest
docker push $ECR_BASE/climaroute-frontend-$ENVIRONMENT:latest

# 5. Update ECS Services
echo "🔄 Updating ECS Services..."
aws ecs update-service --cluster climaroute-$ENVIRONMENT --service ai-service --force-new-deployment
aws ecs update-service --cluster climaroute-$ENVIRONMENT --service backend --force-new-deployment
aws ecs update-service --cluster climaroute-$ENVIRONMENT --service frontend --force-new-deployment

echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
