#!/bin/bash

set -e

echo "=========================================="
echo "NotaVoz - Deployment Script"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure it:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-api-key" ]; then
    echo "ERROR: OPENAI_API_KEY not configured in .env"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-your-anthropic-api-key" ]; then
    echo "ERROR: ANTHROPIC_API_KEY not configured in .env"
    exit 1
fi

echo "1. Building frontend..."
cd frontend
pnpm install --frozen-lockfile
pnpm run build
cd ..

echo "2. Creating data directories..."
mkdir -p backend/data/records

echo "3. Building and starting Docker containers..."
docker-compose -f docker-compose.prod.yml up -d --build

echo "=========================================="
echo "Deployment complete!"
echo ""
echo "The application is now running at:"
echo "  http://localhost (or your server IP)"
echo ""
echo "Default login credentials:"
echo "  Username: $AUTH_USER"
echo "  Password: (as configured in .env)"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "To stop:"
echo "  docker-compose -f docker-compose.prod.yml down"
echo "=========================================="
