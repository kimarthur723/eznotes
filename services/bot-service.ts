import { prisma } from '@/lib/prisma'
import { meetingBaasClient } from '@/lib/meetingbaas/client'
import { generateLiveSummary } from '@/lib/openai/summary'
import { broadcastToMeeting } from '@/lib/websocket/audio-server'

/**
 * Bot Service - Powered by MeetingBaas
 *
 * Handles the full lifecycle of a meeting bot using MeetingBaas API:
 * 1. Create bot to join meeting (Zoom, Google Meet, Teams)
 * 2. MeetingBaas handles recording and transcription
 * 3. Receive transcripts via webhooks
 * 4. Extract action items and insights with GPT-4
 */

export class BotService {
  // Map meetingId to MeetingBaas botId
  private botIds: Map<string, string> = new Map()

  constructor() {
    console.log('[BotService] Initialized with MeetingBaas')
  }

  /**
   * Initialize bot for a meeting
   */
  async startBot(meetingId: string) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
      })

      if (!meeting || !meeting.zoomJoinUrl) {
        throw new Error('Meeting not found or missing meeting URL')
      }

      console.log(`[BotService] Creating MeetingBaas bot for meeting ${meetingId}`)
      console.log(`[BotService] Meeting URL: ${meeting.zoomJoinUrl}`)

      const streamingUrl = process.env.WEBSOCKET_STREAMING_URL

      const bot = await meetingBaasClient.createBot({
        meeting_url: meeting.zoomJoinUrl,
        bot_name: 'EZ Notes Bot',
        recording_mode: 'speaker_view',
        streaming_url: streamingUrl,
      })

      this.botIds.set(meetingId, bot.id)

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'recording',
          startedAt: new Date(),
          zoomMeetingId: bot.id,
        },
      })

      console.log(`[BotService] MeetingBaas bot created successfully!`)
      console.log(`[BotService] Bot ID: ${bot.id}`)
      console.log(`[BotService] Status: ${bot.status}`)
      console.log(`[BotService] Configure webhooks at: https://www.meetingbaas.com/dashboard`)

      return { success: true, botId: bot.id }
    } catch (error: any) {
      console.error('[BotService] Error starting bot:', error)

      // Mark meeting as failed
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'failed' },
      })

      throw error
    }
  }

  /**
   * Stop bot and finalize recording
   */
  async stopBot(meetingId: string) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
      })

      if (!meeting) {
        throw new Error('Meeting not found')
      }

      console.log(`[BotService] Stopping MeetingBaas bot for meeting ${meetingId}`)

      const botId = this.botIds.get(meetingId) || meeting.zoomMeetingId

      if (botId) {
        await meetingBaasClient.stopBot(botId)
        this.botIds.delete(meetingId)
      }

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'processing',
          endedAt: new Date(),
          duration: meeting.startedAt
            ? Math.floor((Date.now() - meeting.startedAt.getTime()) / 1000)
            : 0,
        },
      })

      console.log(`[BotService] Bot stopped for meeting ${meetingId}`)
      console.log(`[BotService] Broadcasting "processing" status to frontend...`)
      broadcastToMeeting(meetingId, {
        type: 'status',
        status: 'processing',
        timestamp: Date.now()
      })

      this.processMeeting(meetingId).catch(error => {
        console.error(`[BotService] Background processing failed for meeting ${meetingId}:`, error)
      })

      return { success: true }
    } catch (error: any) {
      console.error('[BotService] Error stopping bot:', error)
      throw error
    }
  }

  /**
   * Process recorded meeting
   * This runs after the meeting ends
   */
  async processMeeting(meetingId: string) {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          transcripts: {
            orderBy: { timestamp: 'asc' }
          }
        }
      })

      if (!meeting) {
        throw new Error('Meeting not found')
      }

      console.log(`Processing meeting ${meetingId}...`)

      const transcripts = meeting.transcripts

      if (!transcripts || transcripts.length === 0) {
        console.warn(`No transcripts found for meeting ${meetingId}`)
        await prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'completed' },
        })
        return { success: true }
      }

      const fullTranscript = transcripts
        .map(t => `${t.speaker || 'Unknown'}: ${t.text}`)
        .join('\n')

      console.log(`Transcript length: ${fullTranscript.length} characters`)
      console.log(`[BotService] Step 3/4: Generating final summary for meeting ${meetingId}...`)
      let finalSummary = null
      let summaryObject = null
      try {
        summaryObject = await generateLiveSummary(
          transcripts.map(t => ({
            speaker: t.speaker || 'Unknown',
            text: t.text,
            timestamp: t.timestamp
          }))
        )
        finalSummary = JSON.stringify(summaryObject)
        console.log(`[BotService] Final summary generated successfully`)
        console.log(`[BotService] Topics: ${summaryObject.topics.length}, Decisions: ${summaryObject.decisions.length}, Actions: ${summaryObject.actionItems.length}`)
        console.log(`[BotService] Broadcasting final summary to connected clients...`)
        broadcastToMeeting(meetingId, {
          type: 'summary',
          summary: summaryObject,
          timestamp: Date.now(),
          isFinal: true
        })
        console.log(`[BotService] Final summary broadcast complete`)
      } catch (error) {
        console.error(`[BotService] Error generating final summary:`, error)
      }

      console.log(`[BotService] Step 4/4: Updating meeting status to "completed"...`)
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'completed',
          summary: finalSummary
        },
      })
      console.log(`[BotService] Meeting status updated to "completed" in database`)
      console.log(`[BotService] Broadcasting status update to connected clients...`)
      broadcastToMeeting(meetingId, {
        type: 'status',
        status: 'completed',
        timestamp: Date.now()
      })

      console.log(`[BotService] Meeting ${meetingId} processing complete - summary generated and status updated to "completed"`)

      return { success: true }
    } catch (error) {
      console.error('Error processing meeting:', error)

      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'failed' },
      })

      throw error
    }
  }

}

export const botService = new BotService()
