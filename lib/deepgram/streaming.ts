import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import axios from 'axios'

/**
 * Deepgram Live Streaming Service
 *
 * Connects to MeetingBaas audio stream and transcribes in real-time using Deepgram
 */

export interface TranscriptCallback {
  (transcript: {
    text: string
    speaker?: string
    timestamp: number
    isFinal: boolean
  }): void
}

export class DeepgramStreamingService {
  private deepgram: any
  private apiKey: string

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || ''

    if (!this.apiKey) {
      console.warn('[Warning] DEEPGRAM_API_KEY not set. Live transcription will be disabled.')
    }

    this.deepgram = createClient(this.apiKey)
  }

  /**
   * Stream audio from MeetingBaas bot and transcribe in real-time
   */
  async streamFromMeetingBaas(
    botId: string,
    onTranscript: TranscriptCallback,
    onError?: (error: Error) => void
  ): Promise<() => void> {

    if (!this.apiKey) {
      throw new Error('Deepgram API key not configured')
    }

    console.log(`[Deepgram] Starting live transcription stream for bot ${botId}`)

    try {
      // Get audio stream URL from MeetingBaas
      const meetingBaasApiKey = process.env.MEETINGBAAS_API_KEY
      const audioStreamUrl = `https://api.meetingbaas.com/bots/${botId}/audio_stream`

      // Create Deepgram live transcription connection
      const dgConnection = this.deepgram.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        interim_results: true,
        punctuate: true,
        diarize: true, // Speaker diarization
        utterance_end_ms: 1000,
      })

      // Handle transcription results
      dgConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel?.alternatives?.[0]

        if (transcript && transcript.transcript) {
          const words = transcript.words || []
          const speaker = data.channel?.speaker !== undefined
            ? `Speaker ${data.channel.speaker}`
            : undefined

          onTranscript({
            text: transcript.transcript,
            speaker,
            timestamp: words[0]?.start || Date.now() / 1000,
            isFinal: data.is_final || false
          })
        }
      })

      // Handle errors
      dgConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('[Deepgram] Error:', error)
        if (onError) {
          onError(new Error(error.message || 'Deepgram streaming error'))
        }
      })

      // Handle connection close
      dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('[Deepgram] Connection closed')
      })

      // Open connection
      dgConnection.on(LiveTranscriptionEvents.Open, async () => {
        console.log('[Deepgram] Connection opened, starting audio stream...')

        try {
          // Fetch audio stream from MeetingBaas
          const response = await axios.get(audioStreamUrl, {
            headers: {
              'x-meeting-baas-api-key': meetingBaasApiKey,
            },
            responseType: 'stream',
            timeout: 0, // No timeout for streaming
          })

          // Pipe audio to Deepgram
          response.data.on('data', (chunk: Buffer) => {
            if (dgConnection.getReadyState() === 1) {
              dgConnection.send(chunk)
            }
          })

          response.data.on('end', () => {
            console.log('[Audio] Stream ended')
            dgConnection.finish()
          })

          response.data.on('error', (error: Error) => {
            console.error('[Audio] Stream error:', error)
            if (onError) onError(error)
            dgConnection.finish()
          })

        } catch (error: any) {
          console.error('[Error] Failed to fetch audio stream:', error)
          if (onError) onError(error)
          dgConnection.finish()
        }
      })

      // Return cleanup function
      return () => {
        console.log('[Deepgram] Stopping live transcription stream')
        dgConnection.finish()
      }

    } catch (error: any) {
      console.error('[Error] Failed to initialize streaming:', error)
      throw error
    }
  }
}

export const deepgramStreaming = new DeepgramStreamingService()
