import { NextRequest } from 'next/server'

/**
 * Server-Sent Events endpoint for live transcription
 *
 * This endpoint proxies SSE connections to the WebSocket server (port 8081)
 * where live transcripts are broadcast in real-time.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params

  // Proxy to the WebSocket server's HTTP/SSE endpoint
  const sseServerUrl = `http://localhost:8081/stream/${meetingId}`

  console.log(`🎙️  Proxying SSE connection for meeting ${meetingId} to ${sseServerUrl}`)

  try {
    const response = await fetch(sseServerUrl, {
      headers: {
        'Accept': 'text/event-stream',
      },
      // @ts-ignore - Duplex is supported for streaming
      duplex: 'half',
    })

    if (!response.ok) {
      console.error(`Failed to connect to SSE server: ${response.status}`)
      return new Response(JSON.stringify({ error: 'Failed to connect to stream' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Stream the response body back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error proxying SSE stream:', error)
    return new Response(JSON.stringify({ error: 'Failed to connect to live transcription' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
