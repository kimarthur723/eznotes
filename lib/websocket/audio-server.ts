import { WebSocketServer, WebSocket } from 'ws'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { prisma } from '@/lib/prisma'
import { generateLiveSummary } from '@/lib/openai/summary'

/**
 * WebSocket Server for receiving audio from MeetingBaas and forwarding to Deepgram for live transcription.
 */

interface MeetingSession {
  botId: string
  meetingId: string
  deepgramConnection: any
  eventEmitter: EventTarget
  summaryInterval?: NodeJS.Timeout
  lastSpeaker?: string
  lastTranscript?: string
  lastTimestamp?: number
  participantNames?: Map<number, string>
}

const activeSessions = new Map<string, MeetingSession>()
const sseClients = new Map<string, Set<{ send: (data: any) => void }>>()

/**
 * Register SSE client for a meeting
 */
export function registerSSEClient(meetingId: string, client: { send: (data: any) => void }) {
  if (!sseClients.has(meetingId)) {
    sseClients.set(meetingId, new Set())
  }
  sseClients.get(meetingId)!.add(client)

  return () => {
    sseClients.get(meetingId)?.delete(client)
    if (sseClients.get(meetingId)?.size === 0) {
      sseClients.delete(meetingId)
    }
  }
}

/**
 * Send transcript to all SSE clients for a meeting
 */
function broadcastTranscript(meetingId: string, transcript: any) {
  const clients = sseClients.get(meetingId)
  if (clients) {
    console.log(`[SSE] Broadcasting ${transcript.type} to ${clients.size} clients for meeting ${meetingId}`)
    clients.forEach(client => {
      try {
        client.send(transcript)
      } catch (error) {
        console.error('Failed to send to SSE client:', error)
      }
    })
  }
}

/**
 * Broadcast event to all SSE clients for a meeting (exported for external use)
 */
export function broadcastToMeeting(meetingId: string, data: any) {
  broadcastTranscript(meetingId, data)
}

/**
 * Create WebSocket server for audio streaming
 */
export function createAudioWebSocketServer(port: number = 8080) {
  const wss = new WebSocketServer({ port })

  console.log(`WebSocket audio server listening on port ${port}`)

  wss.on('connection', async (ws: WebSocket, req) => {
    console.log('[WebSocket] New connection from MeetingBaas')

    let currentSession: MeetingSession | null = null
    let audioBuffer: Buffer[] = []

    ws.on('message', async (data: Buffer | string) => {
      try {
        // MeetingBaas sends JSON metadata or binary audio data
        const buffer = typeof data === 'string' ? Buffer.from(data) : data

        let isJson = false
        if (buffer[0] === 0x7b) {
          try {
            const str = buffer.toString('utf8')
            JSON.parse(str)
            isJson = true
          } catch {
            isJson = false
          }
        }

        if (isJson) {
          const metadata = JSON.parse(buffer.toString('utf8'))
          console.log('[Metadata] Received speaker metadata:', metadata)
          try {
            ws.send(JSON.stringify({ status: 'ready', protocol_version: 2 }))
            console.log('[WebSocket] Sent acknowledgment to MeetingBaas')
          } catch (error) {
            console.error('Failed to send acknowledgment:', error)
          }

          if (metadata.bot_id) {
            const botId = metadata.bot_id
            const meeting = await prisma.meeting.findFirst({
              where: { zoomMeetingId: botId }
            })

            if (!meeting) {
              console.error('[Error] Meeting not found for bot:', botId)
              ws.close()
              return
            }

            console.log(`[WebSocket] Associated with meeting: ${meeting.id}`)

            const deepgramApiKey = process.env.DEEPGRAM_API_KEY
            if (!deepgramApiKey) {
              console.error('[Error] DEEPGRAM_API_KEY not configured')
              ws.close()
              return
            }

            const deepgram = createClient(deepgramApiKey)
            const dgConnection = deepgram.listen.live({
              model: 'nova-2',
              language: 'en',
              smart_format: true,
              interim_results: true,
              punctuate: true,
              diarize: true,
              utterance_end_ms: 2500,
              encoding: 'linear16',
              sample_rate: 24000,
              channels: 1,
            })

            dgConnection.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
              const transcript = data.channel?.alternatives?.[0]

              if (transcript && transcript.transcript) {
                const words = transcript.words || []
                const speakerId = words[0]?.speaker ??
                                 data.channel?.speaker ??
                                 data.speaker ??
                                 undefined
                let speaker = speakerId !== undefined ? `Speaker ${speakerId}` : 'Unknown'

                const transcriptData = {
                  text: transcript.transcript,
                  speaker,
                  timestamp: words[0]?.start || Date.now() / 1000,
                  isFinal: data.is_final || false
                }

                console.log(`[Transcript] ${transcriptData.isFinal ? 'FINAL' : 'interim'}: "${transcriptData.text}" - ${transcriptData.speaker}`)

                if (transcriptData.isFinal && transcriptData.text.trim()) {
                  try {
                    const timeSinceLastSegment = currentSession?.lastTimestamp
                      ? transcriptData.timestamp - currentSession.lastTimestamp
                      : Infinity

                    const sameSpeaker = currentSession?.lastSpeaker === transcriptData.speaker
                    const withinMergeWindow = timeSinceLastSegment < 5

                    if (sameSpeaker && withinMergeWindow && currentSession?.lastTranscript) {
                      const lastTranscript = await prisma.transcript.findFirst({
                        where: {
                          meetingId: meeting.id,
                          speaker: transcriptData.speaker
                        },
                        orderBy: { timestamp: 'desc' }
                      })

                      if (lastTranscript) {
                        await prisma.transcript.update({
                          where: { id: lastTranscript.id },
                          data: {
                            text: lastTranscript.text + ' ' + transcriptData.text.trim()
                          }
                        })
                        console.log(`[Transcript] Merged with previous segment from ${transcriptData.speaker}`)
                      }
                    } else {
                      await prisma.transcript.create({
                        data: {
                          meetingId: meeting.id,
                          text: transcriptData.text.trim(),
                          speaker: transcriptData.speaker,
                          timestamp: Math.floor(transcriptData.timestamp),
                          confidence: 1.0
                        }
                      })
                      console.log(`[Database] Saved new transcript segment for ${transcriptData.speaker}`)
                    }

                    if (currentSession) {
                      currentSession.lastSpeaker = transcriptData.speaker
                      currentSession.lastTranscript = transcriptData.text
                      currentSession.lastTimestamp = transcriptData.timestamp
                    }
                  } catch (error) {
                    console.error('Failed to save transcript:', error)
                  }
                }

                const clients = sseClients.get(meeting.id)
                console.log(`[SSE] Broadcasting to ${clients?.size || 0} clients for meeting ${meeting.id}`)

                broadcastTranscript(meeting.id, {
                  type: 'transcript',
                  ...transcriptData
                })
              }
            })

            dgConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
              console.error('[Deepgram] Error:', error)
              console.error('Deepgram error details:', JSON.stringify(error, null, 2))
            })

            dgConnection.on(LiveTranscriptionEvents.Close, (closeEvent: any) => {
              console.log('[Deepgram] Connection closed')
              console.log('Close event:', closeEvent)
            })

            dgConnection.on(LiveTranscriptionEvents.Open, () => {
              console.log('[Deepgram] Connection opened and ready to receive audio')
            })

            dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata: any) => {
              console.log('[Deepgram] Metadata:', metadata)
            })

            // Store session
            currentSession = {
              botId,
              meetingId: meeting.id,
              deepgramConnection: dgConnection,
              eventEmitter: new EventTarget(),
              participantNames: new Map<number, string>()
            }
            activeSessions.set(botId, currentSession)

            // Note: We don't map names during live transcription
            // Names will be updated when the meeting completes via webhook

            // Start summary generation interval (every 30 seconds)
            const summaryInterval = setInterval(async () => {
              try {
                console.log(`[AI] Generating live summary for meeting ${meeting.id}...`)

                // Fetch all transcripts for this meeting
                const transcripts = await prisma.transcript.findMany({
                  where: { meetingId: meeting.id },
                  orderBy: { timestamp: 'asc' },
                  select: {
                    speaker: true,
                    text: true,
                    timestamp: true
                  }
                })

                if (transcripts.length === 0) {
                  console.log(`[AI] No transcripts yet for meeting ${meeting.id}, skipping summary`)
                  return
                }

                // Generate summary using OpenAI
                const summary = await generateLiveSummary(transcripts)

                console.log(`[AI] Generated summary:`, {
                  topics: summary.topics.length,
                  decisions: summary.decisions.length,
                  actionItems: summary.actionItems.length
                })

                // Save action items to database
                if (summary.actionItems && summary.actionItems.length > 0) {
                  console.log(`[Database] Saving ${summary.actionItems.length} action items...`)

                  for (const item of summary.actionItems) {
                    try {
                      // Check if this action item already exists
                      const existingItem = await prisma.actionItem.findFirst({
                        where: {
                          meetingId: meeting.id,
                          title: item
                        }
                      })

                      if (!existingItem) {
                        await prisma.actionItem.create({
                          data: {
                            meetingId: meeting.id,
                            title: item,
                            status: 'pending'
                          }
                        })
                        console.log(`[Database] Saved action item: ${item.substring(0, 50)}...`)
                      }
                    } catch (error) {
                      console.error('Failed to save action item:', error)
                    }
                  }
                }

                // Broadcast summary to SSE clients
                broadcastTranscript(meeting.id, {
                  type: 'summary',
                  summary,
                  timestamp: Date.now()
                })

                // Update meeting with latest summary and add to history
                const currentMeeting = await prisma.meeting.findUnique({
                  where: { id: meeting.id },
                  select: { summaryHistory: true }
                })

                const summaryEntry = {
                  timestamp: Date.now(),
                  ...summary
                }

                let summaryHistory: any[] = []
                if (currentMeeting?.summaryHistory) {
                  try {
                    summaryHistory = JSON.parse(currentMeeting.summaryHistory)
                  } catch (e) {
                    console.error('Failed to parse summary history:', e)
                  }
                }

                summaryHistory.push(summaryEntry)

                await prisma.meeting.update({
                  where: { id: meeting.id },
                  data: {
                    summary: JSON.stringify(summary),
                    summaryHistory: JSON.stringify(summaryHistory)
                  }
                })
              } catch (error) {
                console.error('[Error] Failed to generate summary:', error)
              }
            }, 30000) // 30 seconds

            currentSession.summaryInterval = summaryInterval
            console.log(`[AI] Started summary generation interval for meeting ${meeting.id}`)
          }
        } else {
          // Binary audio data - forward to Deepgram
          console.log(`[Audio] Received ${buffer.length} bytes`)

          if (currentSession && currentSession.deepgramConnection) {
            const readyState = currentSession.deepgramConnection.getReadyState()
            console.log(`[Deepgram] Ready state: ${readyState} (1=OPEN)`)

            if (readyState === 1) {
              currentSession.deepgramConnection.send(buffer)
              console.log(`[Deepgram] Sent ${buffer.length} bytes`)
            } else {
              console.log(`[Warning] Deepgram not ready, ready state: ${readyState}`)
            }
          } else {
            // Audio data received before session initialized - this is normal for first few packets
            if (!currentSession) {
              console.log('[Audio] Received data before session initialized (waiting for metadata)')
            } else {
              console.log('[Warning] Session exists but no Deepgram connection')
            }
          }
        }
      } catch (error) {
        console.error('[Error] Failed to process WebSocket message:', error)
      }
    })

    ws.on('close', (code, reason) => {
      console.log(`[WebSocket] Connection closed - Code: ${code}, Reason: ${reason.toString() || 'No reason provided'}`)

      if (currentSession) {
        console.log(`Cleaning up session for bot: ${currentSession.botId}`)

        // Clean up Deepgram connection
        if (currentSession.deepgramConnection) {
          currentSession.deepgramConnection.finish()
        }

        // Clear summary interval
        if (currentSession.summaryInterval) {
          clearInterval(currentSession.summaryInterval)
          console.log(`[AI] Stopped summary generation interval for meeting ${currentSession.meetingId}`)
        }

        activeSessions.delete(currentSession.botId)
      }
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    })
  })

  return wss
}

/**
 * Get active session for a meeting
 */
export function getActiveSession(meetingId: string): MeetingSession | undefined {
  for (const session of activeSessions.values()) {
    if (session.meetingId === meetingId) {
      return session
    }
  }
  return undefined
}
