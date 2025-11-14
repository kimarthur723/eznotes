#!/bin/bash

# Kill existing processes
echo "🛑 Stopping existing processes..."
lsof -ti:3000,3001,8080,8081,9000 | xargs kill -9 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "tsx lib/websocket" 2>/dev/null
pkill -f "proxy-server" 2>/dev/null
sleep 2

# Clear lock file
rm -f /home/rthur/eznotes/.next/dev/lock

# Set the correct WebSocket URL
export WEBSOCKET_STREAMING_URL="wss://intershifting-gilma-synaptical.ngrok-free.dev"

echo "🚀 Starting all services..."
echo "📡 WebSocket URL: $WEBSOCKET_STREAMING_URL"
echo ""

# Start WebSocket server
echo "▶️  Starting WebSocket server..."
npm run dev:ws > /dev/null 2>&1 &
sleep 2

# Start Next.js
echo "▶️  Starting Next.js..."
npm run dev > /dev/null 2>&1 &
sleep 3

# Start proxy server
echo "▶️  Starting proxy server..."
node proxy-server.js > /dev/null 2>&1 &
sleep 1

echo ""
echo "✅ All services started!"
echo "   - WebSocket: ports 8080/8081"
echo "   - Next.js: port 3000"
echo "   - Proxy: port 9000"
echo "   - ngrok: https://intershifting-gilma-synaptical.ngrok-free.dev"
echo ""
echo "🎯 Ready to test live transcription!"
