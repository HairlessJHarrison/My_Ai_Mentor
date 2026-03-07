#!/bin/bash
# Unplugged — First-time Raspberry Pi setup script
set -e

echo "🌿 Unplugged — Pi Setup"
echo "======================="

# Update system
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed. You may need to log out and back in."
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "🐳 Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "✅ Docker Compose already installed"
fi

# Create .env if not exists
if [ ! -f .env ]; then
    echo "🔐 Creating .env file..."
    cp .env.example .env
    # Generate a random API key
    API_KEY=$(openssl rand -hex 32)
    sed -i "s/your-secret-api-key-here/$API_KEY/" .env
    echo "✅ Generated API key: $API_KEY"
    echo "   Save this key for your OpenClaw configuration."
fi

# Build frontend
echo "🏗️ Building frontend..."
if command -v npm &> /dev/null; then
    cd frontend && npm install && npm run build && cd ..
else
    echo "⚠️  npm not found. Install Node.js to build the frontend:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    echo "   Then run: cd frontend && npm install && npm run build"
fi

# Start services
echo "🚀 Starting Unplugged..."
docker compose up -d --build

echo ""
echo "✅ Unplugged is running!"
echo "   Dashboard: http://$(hostname -I | awk '{print $1}')"
echo "   API Docs:  http://$(hostname -I | awk '{print $1}')/api/v1/docs"
echo ""
echo "🌿 Be present. Be together."
