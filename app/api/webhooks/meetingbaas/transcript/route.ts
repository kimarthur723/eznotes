import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { meetingBaasClient } from '@/lib/meetingbaas/client'

/**
 * MeetingBaas Transcript Webhook Handler
 *
 * Receives webhooks from MeetingBaas when meetings complete or transcripts are available.
 * Note: The bot is automatically stopped when meeting.completed event is received
 * in the /api/webhooks/meetingbaas/events endpoint to prevent continued charging.
 *
 * Webhook payload example:
 * {
 *   "event": "complete",
 *   "bot_id": "bot_123456",
 *   "meeting_url": "https://zoom.us/j/123456789",
 *   "recording_url": "https://api.meetingbaas.com/recordings/bot_123456.mp4",
 *   "transcript_url": "https://api.meetingbaas.com/transcripts/bot_123456.json",
 *   "duration": 3600,
 *   "participants": 5,
 *   "created_at": "2024-01-01T12:00:00Z"
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[Webhook] Received MeetingBaas event:', JSON.stringify(body, null, 2))

    const { event, transcript_url, recording_url, duration, data } = body
    // Extract bot_id from the correct location (could be top-level or in data)
    const bot_id = body.bot_id || data?.bot_id

    if (!bot_id) {
      console.error(`[Webhook] Error: No bot_id found in webhook payload`)
      return NextResponse.json(
        { error: 'Missing bot_id' },
        { status: 400 }
      )
    }

    console.log(`[Webhook] Looking for meeting with bot_id: ${bot_id}`)

    // Find the meeting by bot_id (stored in zoomMeetingId field)
    const meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: bot_id },
    })

    if (!meeting) {
      console.error(`[Webhook] Error: Meeting not found for bot_id: ${bot_id}`)
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    console.log(`[Webhook] Found meeting: ${meeting.id} for bot_id: ${bot_id}`)

    // Handle different event types
    switch (event) {
      case 'complete':
        console.log(`[Webhook] Meeting ${meeting.id} completed`)

        // Automatically stop the bot to prevent continued charging
        try {
          await meetingBaasClient.stopBot(bot_id)
          console.log(`[Webhook] Bot automatically stopped for completed meeting ${meeting.id}`)
        } catch (error) {
          console.error(`[Webhook] Warning: Failed to auto-stop bot for meeting ${meeting.id}:`, error)
          // Continue processing even if stop fails
        }

        // Extract transcript from webhook data
        const transcriptData = body.data?.transcript || []
        const speakers = body.data?.speakers || []
        const mp4Url = body.data?.mp4
        const audioUrl = body.data?.audio

        console.log(`[Webhook] Received ${transcriptData.length} transcript segments`)
        console.log(`[Webhook] Speakers in meeting:`, speakers)

        // Save participants and update transcript speaker names
        if (speakers && speakers.length > 0) {
          console.log(`[Webhook] Updating speaker names in transcripts...`)

          for (let i = 0; i < speakers.length; i++) {
            const speakerName = speakers[i]
            const speakerLabel = `Speaker ${i}`

            try {
              // Save participant
              const existingParticipant = await prisma.participant.findFirst({
                where: {
                  meetingId: meeting.id,
                  name: speakerName
                }
              })

              if (!existingParticipant) {
                await prisma.participant.create({
                  data: {
                    meetingId: meeting.id,
                    name: speakerName,
                    role: 'attendee'
                  }
                })
                console.log(`[Webhook] Saved participant: ${speakerName}`)
              }

              // Update all transcripts with this speaker ID to use actual name
              const updateResult = await prisma.transcript.updateMany({
                where: {
                  meetingId: meeting.id,
                  speaker: speakerLabel
                },
                data: {
                  speaker: speakerName
                }
              })

              if (updateResult.count > 0) {
                console.log(`[Webhook] Updated ${updateResult.count} transcripts: "${speakerLabel}" → "${speakerName}"`)
              }
            } catch (error) {
              console.error(`Failed to update speaker ${speakerName}:`, error)
            }
          }
        }

        // Save transcript segments to database
        for (const segment of transcriptData) {
          const text = segment.words?.map((w: any) => w.word).join(' ') || ''
          const startTime = segment.start_time || segment.offset || 0

          if (text.trim()) {
            await prisma.transcript.create({
              data: {
                meetingId: meeting.id,
                text: text.trim(),
                speaker: segment.speaker || 'Unknown',
                timestamp: Math.floor(startTime),
                confidence: 1.0, // MeetingBaas doesn't provide confidence per segment
              },
            })
          }
        }

        // Calculate duration from last transcript timestamp
        const lastSegment = transcriptData[transcriptData.length - 1]
        const durationSeconds = lastSegment?.end_time
          ? Math.floor(lastSegment.end_time)
          : duration || 0

        // Update meeting as completed
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: 'completed',
            endedAt: new Date(),
            duration: durationSeconds,
            audioFileUrl: mp4Url || audioUrl,
          },
        })

        console.log(`[Webhook] Saved ${transcriptData.length} transcript segments and marked meeting as completed`)
        break

      case 'failed':
        console.error(`[Webhook] Bot failed for meeting ${meeting.id}`)
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: 'failed' },
        })
        break

      case 'bot.status_change':
        console.log(`[Webhook] Bot status changed for meeting ${meeting.id}:`, body)
        // You can update meeting status based on bot status if needed
        break

      default:
        console.log(`[Webhook] Info: Unhandled event type: ${event}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json({
    message: 'MeetingBaas webhook endpoint',
    status: 'active',
  })
}
