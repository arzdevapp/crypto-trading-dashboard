#!/bin/bash
# =============================================================
# Crypto Trading Dashboard — First-Time Proxmox Setup
# Run once as root on your Proxmox VM/LXC
# Tested on Ubuntu 22.04 / Debian 12
# =============================================================

set -e

APP_DIR="/opt/crypto-trading-dashboard"
REPO_URL="https://github.com/arzdevapp/crypto-trading-dashboard.git"
BRANCH="main"   # change to your target branch

echo "=== Installing system dependencies ==="
apt-get update -y
apt-get install -y curl git build-essential

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PM2 (process manager — survives reboots)
npm install -g pm2

echo "=== Cloning repository ==="
git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

echo "=== Installing npm dependencies ==="
npm ci --production=false

echo "=== Setting up environment ==="
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env" 2>/dev/null || cat > "$APP_DIR/.env" << 'ENVEOF'
DATABASE_URL=file:/opt/crypto-trading-dashboard/data/prod.db
NEXT_PUBLIC_WS_URL=ws://localhost:8080
WS_PORT=8080
PORT=3000
ENVEOF
  echo "Created .env — edit $APP_DIR/.env to add exchange API keys."
fi

echo "=== Running DB migrations ==="
mkdir -p "$APP_DIR/data"
npx prisma migrate deploy
npx prisma generate

echo "=== Building Next.js ==="
npm run build

echo "=== Starting with PM2 ==="
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save

# Auto-start PM2 on reboot
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root

echo "=== Setting up auto-update cron (daily at midnight) ==="
chmod +x "$APP_DIR/scripts/deploy.sh"
(crontab -l 2>/dev/null; echo "0 0 * * * bash $APP_DIR/scripts/deploy.sh >> $APP_DIR/logs/cron.log 2>&1") | crontab -

echo ""
echo "=== Setup complete ==="
echo "Dashboard: http://$(hostname -I | awk '{print $1}'):3000"
echo "PM2 status: pm2 status"
echo "Live logs:  pm2 logs"
echo "Deploy now: bash $APP_DIR/scripts/deploy.sh"
