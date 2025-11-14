/**
 * WebSocket Server Entry Point
 *
 * This script starts the WebSocket server that receives live audio from MeetingBaas
 * and transcribes it using Deepgram.
 * Also provides HTTP/SSE endpoint for frontend connections.
 */

import 'dotenv/config'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { createAudioWebSocketServer, registerSSEClient } from './audio-server'

const WS_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080')
const HTTP_PORT = WS_PORT + 1 // 8081

console.log('🚀 Starting WebSocket audio server...')
console.log(`📡 WebSocket Port: ${WS_PORT}`)
console.log(`📡 HTTP/SSE Port: ${HTTP_PORT}`)
console.log(`🔑 Deepgram API Key: ${process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Not set'}`)

// Start the WebSocket server
const wsServer = createAudioWebSocketServer(WS_PORT)

console.log(`✅ WebSocket server ready on ws://localhost:${WS_PORT}`)
console.log('🎙️  Waiting for MeetingBaas connections...')

// Create HTTP server for SSE endpoints
const httpServer = createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // SSE endpoint: /stream/:meetingId
  const streamMatch = req.url?.match(/^\/stream\/([^/]+)$/)
  if (streamMatch && req.method === 'GET') {
    const meetingId = streamMatch[1]
    console.log(`📡 SSE client connected for meeting: ${meetingId}`)

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

    // Register this client
    const unregister = registerSSEClient(meetingId, {
      send: (data) => {
        try {
          res.write(`data: ${JSON.stringify(data)}\n\n`)
        } catch (error) {
          console.error('Failed to send SSE message:', error)
        }
      }
    })

    // Handle client disconnect
    req.on('close', () => {
      console.log(`🔌 SSE client disconnected for meeting: ${meetingId}`)
      unregister()
    })

    return
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

httpServer.listen(HTTP_PORT, () => {
  console.log(`✅ HTTP/SSE server ready on http://localhost:${HTTP_PORT}`)
})

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...')
  wsServer.close(() => {
    console.log('✅ WebSocket server closed')
    httpServer.close(() => {
      console.log('✅ HTTP server closed')
      process.exit(0)
    })
  })
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down servers...')
  wsServer.close(() => {
    console.log('✅ WebSocket server closed')
    httpServer.close(() => {
      console.log('✅ HTTP server closed')
      process.exit(0)
    })
  })
})
