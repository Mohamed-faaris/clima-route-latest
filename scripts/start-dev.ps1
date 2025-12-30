# ============================================
# Local Development with Docker Compose
# ============================================

# PowerShell script for Windows users

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🚀 Starting ClimaRoute Development Environment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check if Docker is running
$docker = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "⚠️ Docker Desktop is not running. Please start it first." -ForegroundColor Yellow
    exit 1
}

# Start services
Write-Host "`n📦 Starting database and AI service..." -ForegroundColor Green
docker compose -f docker-compose.dev.yml up -d

Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check AI service health
Write-Host "`n🔍 Checking AI service health..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5001/health" -Method Get -TimeoutSec 30
    Write-Host "✅ AI Service: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "⚠️ AI Service not ready yet. It may take up to 60 seconds for model to load." -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "🎉 Development environment is ready!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor White
Write-Host "  📊 Database (PostgreSQL): localhost:5432" -ForegroundColor Gray
Write-Host "  🤖 AI Service:            http://localhost:5001" -ForegroundColor Gray
Write-Host "  🗄️ Adminer (DB GUI):       http://localhost:8080" -ForegroundColor Gray
Write-Host ""
Write-Host "To start Backend manually:" -ForegroundColor White
Write-Host "  cd BACKEND/ClimaRouteAPI && dotnet run" -ForegroundColor Gray
Write-Host ""
Write-Host "To start Frontend manually:" -ForegroundColor White
Write-Host "  cd 'climaroute FRONT END' && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop all services:" -ForegroundColor White
Write-Host "  docker compose -f docker-compose.dev.yml down" -ForegroundColor Gray
Write-Host ""
