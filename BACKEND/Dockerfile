# Backend .NET API Dockerfile

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore
COPY ClimaRouteAPI/ClimaRouteAPI.csproj ./ClimaRouteAPI/
RUN dotnet restore ./ClimaRouteAPI/ClimaRouteAPI.csproj

# Copy source code
COPY ClimaRouteAPI/ ./ClimaRouteAPI/

# Build
WORKDIR /src/ClimaRouteAPI
RUN dotnet publish -c Release -o /app/publish

# Production stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy published output
COPY --from=build /app/publish .

# Environment variables
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV AI_SERVICE_URL=http://ai-service:5001
ENV ConnectionStrings__DefaultConnection="Host=db;Database=climaroute;Username=postgres;Password=postgres"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

EXPOSE 5000

ENTRYPOINT ["dotnet", "ClimaRouteAPI.dll"]
