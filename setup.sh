#!/bin/bash
# SuperTokens Core Node.js - Quick Start Script

set -e

echo "🚀 SuperTokens Core Node.js - Setup"
echo "===================================="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v)
echo "✓ Node.js version: $NODE_VERSION"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✓ .env created from .env.example"
    echo "  Please edit .env with your configuration"
else
    echo "✓ .env file already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build
echo "✓ Build complete"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev:watch  - Run in development mode with watch"
echo "  npm run dev        - Run in development mode"
echo "  npm start          - Run in production"
echo "  npm test           - Run tests"
echo "  npm run lint       - Run linter"
echo "  npm run lint:fix   - Fix linting issues"
echo "  npm run format     - Format code"
echo ""
echo "Docker:"
echo "  docker-compose up  - Start with MySQL"
echo ""
