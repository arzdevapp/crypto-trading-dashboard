#!/bin/bash
set -e

echo "🔨 Building production bundle..."
npm run build

echo "📦 Installing PM2 globally (if not already installed)..."
npm install -g pm2 || true

echo "🛑 Stopping any existing processes..."
pm2 delete all 2>/dev/null || true

echo "🚀 Starting Next.js server..."
pm2 start "npm run start -- -p 3456" --name "next" --env production

echo "🚀 Starting WebSocket server..."
pm2 start "npx tsx server/index.ts" --name "ws-server" --env production

echo "💾 Saving PM2 process list..."
pm2 save

echo "🔄 Configuring auto-start on system reboot..."
pm2 startup systemd -u root --hp /root

echo ""
echo "✅ Production setup complete!"
echo ""
echo "Available commands:"
echo "  pm2 status        - Check running processes"
echo "  pm2 logs          - View logs (tail -f style)"
echo "  pm2 restart all   - Restart after git pull"
echo "  pm2 stop all      - Stop everything"
echo "  pm2 delete all    - Remove from auto-start"
echo ""
echo "Access dashboard at: http://192.168.0.175:3456"
