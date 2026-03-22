#!/bin/bash
# =============================================================
# Crypto Trading Dashboard — Deploy Script
# Run on your Proxmox VM/LXC as: bash scripts/deploy.sh
# =============================================================

set -e

APP_DIR="/opt/crypto-trading-dashboard"
BRANCH="main"   # change to your target branch
LOG="$APP_DIR/logs/deploy.log"

mkdir -p "$APP_DIR/logs"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting deploy..." | tee -a "$LOG"

cd "$APP_DIR"

# 1. Pull latest from GitHub
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulling latest code..." | tee -a "$LOG"
git fetch origin "$BRANCH"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Already up to date. Skipping." | tee -a "$LOG"
  exit 0
fi

git pull origin "$BRANCH"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updated from $LOCAL to $REMOTE" | tee -a "$LOG"

# 2. Install dependencies (only if package.json changed)
if git diff "$LOCAL" "$REMOTE" --name-only | grep -q "package.json"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing dependencies..." | tee -a "$LOG"
  npm ci --production=false
fi

# 3. Run DB migrations
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running DB migrations..." | tee -a "$LOG"
npx prisma migrate deploy
npx prisma generate

# 4. Build Next.js
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Building..." | tee -a "$LOG"
npm run build

# 5. Restart PM2 processes
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting PM2..." | tee -a "$LOG"
pm2 reload ecosystem.config.js --update-env

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy complete." | tee -a "$LOG"
