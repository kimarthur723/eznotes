#!/bin/bash

# EZ Notes Development Startup Script
# Starts all required services for the application

set -e

echo "🚀 Starting EZ Notes Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}⚠️  ngrok not found. Please install ngrok: https://ngrok.com/download${NC}"
    exit 1
fi

# Kill any existing processes on our ports
echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
lsof -ti:9000 | xargs kill -9 2>/dev/null || true
sleep 1

# Create logs directory
mkdir -p logs

# Start Next.js frontend
echo -e "${GREEN}▶️  Starting Next.js frontend (port 3000)...${NC}"
npm run dev > logs/nextjs.log 2>&1 &
NEXTJS_PID=$!
sleep 3

# Start WebSocket server
echo -e "${GREEN}▶️  Starting WebSocket server (port 8080)...${NC}"
npm run dev:ws > logs/websocket.log 2>&1 &
WS_PID=$!
sleep 2

# Start reverse proxy
echo -e "${GREEN}▶️  Starting reverse proxy (port 9000)...${NC}"
node proxy-server.js > logs/proxy.log 2>&1 &
PROXY_PID=$!
sleep 2

# Start ngrok tunnel
echo -e "${GREEN}▶️  Starting ngrok tunnel...${NC}"
ngrok http 9000 --log=stdout > logs/ngrok.log 2>&1 &
NGROK_PID=$!
sleep 3

# Extract ngrok URL
echo -e "${BLUE}📡 Fetching ngrok URL...${NC}"
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not fetch ngrok URL automatically${NC}"
    echo -e "${YELLOW}   Visit http://localhost:4040 to see your ngrok URL${NC}"
else
    echo ""
    echo -e "${GREEN}✅ All services started successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Service URLs:${NC}"
    echo -e "   Frontend:     http://localhost:3000"
    echo -e "   WebSocket:    ws://localhost:8080"
    echo -e "   Proxy:        http://localhost:9000"
    echo -e "   ngrok:        ${NGROK_URL}"
    echo -e "   ngrok admin:  http://localhost:4040"
    echo ""
    echo -e "${YELLOW}💡 WebSocket Streaming URL for MeetingBaas:${NC}"
    echo -e "   ${NGROK_URL/https/wss}"
    echo ""
    echo -e "${BLUE}📝 Logs are being written to the logs/ directory${NC}"
    echo -e "${YELLOW}⚠️  Make sure to update your .env file with the ngrok URL if it changed${NC}"
fi

echo ""
echo -e "${GREEN}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background processes
wait
