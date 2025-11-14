import axios, { AxiosInstance } from 'axios'

/**
 * MeetingBaas API Client
 *
 * Official API: https://meetingbaas.com/docs
 *
 * MeetingBaas allows you to:
 * - Join Zoom, Google Meet, and Microsoft Teams meetings
 * - Record and transcribe meetings in real-time
 * - Get webhooks for transcripts and events
 */

export interface BotConfig {
  meeting_url: string
  bot_name?: string
  recording_mode?: 'speaker_view' | 'gallery_view' | 'audio_only'
  transcription_provider?: 'deepgram' | 'default'
  webhook_url?: string
  streaming_url?: string // WebSocket URL for real-time audio streaming
}

export interface Bot {
  id: string
  meeting_url: string
  status: 'waiting' | 'joining' | 'in_meeting' | 'completed' | 'failed'
  bot_name: string
  created_at: string
  meeting_platform?: string
}

export interface TranscriptSegment {
  text: string
  speaker: string
  timestamp: number
  confidence?: number
}

export class MeetingBaasClient {
  private client: AxiosInstance
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MEETINGBAAS_API_KEY || ''

    if (!this.apiKey) {
      console.warn('[Warning] MEETINGBAAS_API_KEY not set. Bot creation will fail.')
    }

    this.client = axios.create({
      baseURL: 'https://api.meetingbaas.com',
      headers: {
        'x-meeting-baas-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })
  }

  /**
   * Create a bot to join a meeting
   */
  async createBot(config: BotConfig): Promise<Bot> {
    try {
      const payload: any = {
        meeting_url: config.meeting_url,
        bot_name: config.bot_name || 'EZ Notes Bot',
        recording_mode: config.recording_mode || 'speaker_view',
        reserved: false, // Join immediately
      }

      // Only use MeetingBaas transcription if NOT streaming
      // When streaming, we handle transcription ourselves via Deepgram
      if (!config.streaming_url) {
        payload.speech_to_text = {
          provider: 'Default', // MeetingBaas uses "Default" for their transcription
        }
      }

      // Add streaming configuration if URL provided
      if (config.streaming_url) {
        payload.streaming = {
          output: config.streaming_url,
          audio_frequency: '24khz'
        }
        console.log(`[Streaming] Enabled to: ${config.streaming_url}`)
      }

      console.log('[MeetingBaas] Creating bot with payload:', JSON.stringify(payload, null, 2))

      const response = await this.client.post('/bots', payload)

      console.log('[MeetingBaas] Bot created:', response.data)

      // Normalize the response: MeetingBaas returns bot_id but we use id internally
      const bot = {
        ...response.data,
        id: response.data.bot_id || response.data.id,
      }

      return bot
    } catch (error: any) {
      console.error('[MeetingBaas] API Error:', error.response?.data || error.message)
      if (error.response) {
        console.error('Response status:', error.response.status)
        console.error('Response headers:', error.response.headers)
      }
      throw new Error(`Failed to create bot: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Get bot status
   */
  async getBot(botId: string): Promise<Bot> {
    try {
      const response = await this.client.get(`/bots/${botId}`)

      // Normalize the response: MeetingBaas returns bot_id but we use id internally
      const bot = {
        ...response.data,
        id: response.data.bot_id || response.data.id,
      }

      return bot
    } catch (error: any) {
      console.error('[MeetingBaas] API Error:', error.response?.data || error.message)
      throw new Error(`Failed to get bot: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Stop/leave a bot from the meeting
   */
  async stopBot(botId: string): Promise<void> {
    try {
      await this.client.delete(`/bots/${botId}`)
      console.log(`[MeetingBaas] Bot ${botId} stopped successfully`)
    } catch (error: any) {
      console.error('[MeetingBaas] API Error:', error.response?.data || error.message)
      throw new Error(`Failed to stop bot: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Get transcript for a bot (real-time during meeting)
   * Returns formatted transcript segments
   */
  async getTranscript(botId: string): Promise<TranscriptSegment[]> {
    try {
      const response = await this.client.get(`/bots/${botId}/transcript`)
      const rawTranscript = response.data.transcript || response.data || []

      // MeetingBaas returns transcript in format:
      // [{ speaker: "name", start_time: 1.5, end_time: 3.2, words: [{word: "hello", start: 1.5, end: 1.8}] }]
      // Convert to our format
      const segments: TranscriptSegment[] = []

      for (const segment of rawTranscript) {
        const text = segment.words?.map((w: any) => w.word).join(' ') || segment.text || ''

        if (text.trim()) {
          segments.push({
            text: text.trim(),
            speaker: segment.speaker || 'Unknown',
            timestamp: Math.floor(segment.start_time || segment.offset || 0),
            confidence: 1.0
          })
        }
      }

      return segments
    } catch (error: any) {
      console.error('[MeetingBaas] API Error:', error.response?.data || error.message)
      return []
    }
  }

  /**
   * Delete a bot (cleanup)
   */
  async deleteBot(botId: string): Promise<void> {
    try {
      await this.client.delete(`/bots/${botId}`)
      console.log(`[MeetingBaas] Bot ${botId} deleted successfully`)
    } catch (error: any) {
      console.error('[MeetingBaas] API Error:', error.response?.data || error.message)
    }
  }

  /**
   * Get participants/attendees in the meeting
   * This may return participant names that we can map to speaker IDs
   */
  async getParticipants(botId: string): Promise<string[]> {
    try {
      // Try to get bot details which might include participant info
      const bot = await this.getBot(botId)

      // MeetingBaas might provide participants in the bot response
      // If not available, return empty array
      const participants = (bot as any).participants || (bot as any).attendees || []

      console.log(`[MeetingBaas] Participants:`, participants)
      return participants.map((p: any) => p.name || p.email || 'Unknown')
    } catch (error: any) {
      console.error('[Error] Failed to get participants:', error.message)
      return []
    }
  }
}

export const meetingBaasClient = new MeetingBaasClient()
