#!/bin/bash
# ============================================
# SCRAM Gestión Logística - Deploy Script
# Target: /srv/scram-apps on prod-server
# ============================================

set -e

echo "=== SCRAM Gestión Logística - Deployment ==="

# Navigate to project directory
cd /srv/scram-apps

# Copy environment file if not exists
if [ ! -f .env ]; then
    echo "Creating .env from .env.production template..."
    cp .env.production .env
    echo "WARNING: Please update .env with real credentials before starting!"
    exit 1
fi

# Create external network if not exists
docker network create traefik 2>/dev/null || true

# Pull latest images and build
echo "Building Docker images..."
docker compose build --no-cache

# Stop existing containers (if any)
echo "Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Start services
echo "Starting services..."
docker compose up -d

# Wait for health checks
echo "Waiting for services to be healthy..."
sleep 30

# Check service status
echo ""
echo "=== Service Status ==="
docker compose ps

echo ""
echo "=== Health Check ==="
curl -s http://localhost:3000/api/v1/health/liveness || echo "API not responding yet..."

echo ""
echo "=== Deployment Complete ==="
echo "Frontend: https://gestion-logistica.scram2k.com"
echo "API: https://api-gestion-logistica.scram2k.com"
echo "Mobile: https://app-gestion-logistica.scram2k.com"
