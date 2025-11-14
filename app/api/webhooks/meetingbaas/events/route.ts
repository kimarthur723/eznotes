import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { meetingBaasClient } from '@/lib/meetingbaas/client'

/**
 * MeetingBaas Events Webhook
 *
 * Receives bot status events from MeetingBaas:
 * - meeting.started - Bot successfully joined the meeting
 * - meeting.completed - Meeting has ended (AUTO-STOP BOT)
 * - meeting.failed - Meeting failed to start
 * - bot.joined - Bot successfully joined the meeting (legacy)
 * - bot.left - Bot left the meeting
 * - bot.error - Bot encountered an error
 * - recording.started - Recording started
 * - recording.stopped - Recording stopped
 *
 * Webhook payload example:
 * {
 *   "bot_id": "bot_abc123",
 *   "event": "meeting.started",
 *   "timestamp": "2024-01-15T10:30:00Z",
 *   "data": {
 *     "meeting_platform": "zoom",
 *     "participants_count": 5
 *   }
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📨 [Webhook] Received MeetingBaas event:', body)

    const { event, data, timestamp } = body
    // Extract bot_id from the correct location (could be top-level or in data)
    const bot_id = body.bot_id || data?.bot_id

    if (!bot_id) {
      console.error(`❌ [Webhook] No bot_id found in webhook payload`)
      return NextResponse.json(
        { error: 'Missing bot_id' },
        { status: 400 }
      )
    }

    console.log(`🔍 [Webhook] Looking for meeting with bot_id: ${bot_id}`)

    // Find the meeting by bot_id
    const meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: bot_id },
    })

    if (!meeting) {
      console.error(`❌ [Webhook] Meeting not found for bot_id: ${bot_id}`)
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    console.log(`✅ [Webhook] Found meeting: ${meeting.id} for bot_id: ${bot_id}`)

    // Handle different event types
    switch (event) {
      case 'meeting.started':
      case 'bot.joined':
        console.log(`✅ [Webhook] ${event === 'meeting.started' ? 'Meeting started' : 'Bot joined'} for meeting ${meeting.id}`)
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: 'recording',
            startedAt: meeting.startedAt || new Date(timestamp || new Date()),
          },
        })
        break

      case 'meeting.completed':
        console.log(`🏁 [Webhook] Meeting completed for meeting ${meeting.id} - automatically stopping bot`)

        // Automatically stop the bot to prevent continued charging
        try {
          await meetingBaasClient.stopBot(bot_id)
          console.log(`✅ [Webhook] Bot automatically stopped for completed meeting ${meeting.id}`)
        } catch (error) {
          console.error(`⚠️  [Webhook] Failed to auto-stop bot for meeting ${meeting.id}:`, error)
          // Continue processing even if stop fails
        }

        // Update meeting status
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: 'processing',
            endedAt: new Date(timestamp || new Date()),
          },
        })
        break

      case 'meeting.failed':
        console.error(`❌ [Webhook] Meeting failed for meeting ${meeting.id}:`, data)
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'failed' },
        })
        break

      case 'bot.left':
        console.log(`👋 [Webhook] Bot left meeting ${meeting.id}`)
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: 'processing',
            endedAt: new Date(timestamp),
          },
        })
        break

      case 'bot.error':
        console.error(`❌ [Webhook] Bot error for meeting ${meeting.id}:`, data)
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'failed' },
        })
        break

      case 'recording.started':
        console.log(`🎙️  [Webhook] Recording started for meeting ${meeting.id}`)
        break

      case 'recording.stopped':
        console.log(`⏹️  [Webhook] Recording stopped for meeting ${meeting.id}`)
        break

      default:
        console.log(`ℹ️  [Webhook] Unknown event type: ${event}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ [Webhook] Error processing event:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json({
    message: 'MeetingBaas events webhook endpoint',
    status: 'active',
  })
}
