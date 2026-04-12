#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# CHVC Crystal PM Assistant — Hetzner Server Setup Script
# Run this ONCE on a fresh Debian/Ubuntu Hetzner VPS as root.
# Usage:  bash deploy.sh
# ─────────────────────────────────────────────────────────────────
set -e

APP_DIR="/opt/chvc"
REPO_URL="https://github.com/IHateAstrology/chvc-self-hosted.git"

echo ""
echo "======================================================"
echo "  CHVC Crystal PM Assistant — Server Setup"
echo "======================================================"
echo ""

# ── 1. Update system ──────────────────────────────────────
echo "[1/6] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ─────────────────────────────────────
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "      Docker installed."
else
    echo "      Docker already installed, skipping."
fi

# ── 3. Install Git ────────────────────────────────────────
echo "[3/6] Installing Git..."
apt-get install -y -qq git

# ── 4. Clone the repository ───────────────────────────────
echo "[4/6] Cloning repository to ${APP_DIR}..."
if [ -d "$APP_DIR" ]; then
    echo "      Directory exists — pulling latest changes..."
    cd "$APP_DIR" && git pull
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 5. Set up environment file ────────────────────────────
echo "[5/6] Setting up environment..."
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo ""
    echo "  ┌─────────────────────────────────────────────────┐"
    echo "  │  ACTION REQUIRED: Add your Gemini API key       │"
    echo "  │                                                  │"
    echo "  │  Get your key at: https://aistudio.google.com   │"
    echo "  │                                                  │"
    echo "  │  Then run:                                       │"
    echo "  │    nano /opt/chvc/.env                          │"
    echo "  │  and replace 'your-gemini-api-key-here'         │"
    echo "  └─────────────────────────────────────────────────┘"
    echo ""
    read -p "  Press Enter after you have edited the .env file..." _
else
    echo "      .env already exists, skipping."
fi

# ── 6. Build and start Docker container ───────────────────
echo "[6/6] Building and starting the app..."
cd "$APP_DIR"
docker compose up -d --build

echo ""
echo "======================================================"
echo "  Setup complete!"
echo ""
echo "  App is running on port 3060."
echo "  Health check: curl http://localhost:3060/api/health"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f          (view live logs)"
echo "    docker compose restart          (restart app)"
echo "    docker compose down             (stop app)"
echo ""
echo "  To update the app in future:"
echo "    cd /opt/chvc && git pull && docker compose up -d --build"
echo "======================================================"
