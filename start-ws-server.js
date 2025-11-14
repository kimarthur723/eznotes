#!/usr/bin/env node

/**
 * WebSocket Server Startup Script
 *
 * This script starts the WebSocket server that receives live audio from MeetingBaas
 * and transcribes it using Deepgram.
 */

// Load environment variables
require('dotenv').config()

// Import the server (needs to be transpiled from TypeScript)
const { createAudioWebSocketServer } = require('./lib/websocket/audio-server')

const PORT = process.env.WEBSOCKET_PORT || 8080

console.log('🚀 Starting WebSocket audio server...')
console.log(`📡 Port: ${PORT}`)
console.log(`🔑 Deepgram API Key: ${process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Not set'}`)

// Start the server
const server = createAudioWebSocketServer(PORT)

console.log(`✅ WebSocket server ready on ws://localhost:${PORT}`)
console.log('🎙️  Waiting for MeetingBaas connections...')

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WebSocket server...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})
