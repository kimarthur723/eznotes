'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

type Meeting = {
  id: string
  title: string
  status: string
  zoomJoinUrl: string
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  duration: number | null
  summary: string | null
  participants: any[]
  actionItems: any[]
  transcripts: any[]
}

export default function MeetingDetail() {
  const params = useParams()
  const router = useRouter()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [newTranscriptsCount, setNewTranscriptsCount] = useState(0)
  const [liveTranscripts, setLiveTranscripts] = useState<Array<{
    text: string
    speaker?: string
    timestamp: number
    isFinal: boolean
  }>>([])
  const [streamConnected, setStreamConnected] = useState(false)
  const [liveSummary, setLiveSummary] = useState<{
    topics: string[]
    decisions: string[]
    actionItems: string[]
  } | null>(null)
  const [summaryUpdating, setSummaryUpdating] = useState(false)

  // Parse final summary when meeting is completed
  // Show empty summary structure during recording to display headers immediately
  const displaySummary = liveSummary || (meeting?.summary ? (() => {
    try {
      return JSON.parse(meeting.summary)
    } catch (e) {
      return null
    }
  })() : null) || (meeting?.status === 'recording' ? { topics: [], decisions: [], actionItems: [] } : null)

  useEffect(() => {
    if (params.id) {
      fetchMeeting()
    }
  }, [params.id])

  // Connect to live transcription stream when recording
  useEffect(() => {
    if (!meeting || meeting.status !== 'recording') {
      setStreamConnected(false)
      return
    }

    console.log('[Stream] Connecting to live transcription stream...')

    const eventSource = new EventSource(`/api/meetings/${params.id}/stream`)

    eventSource.onopen = () => {
      console.log('[Stream] Connected to live transcription stream')
      setStreamConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'transcript') {
          setLiveTranscripts(prev => {
            // If it's a final transcript, remove any interim versions
            if (data.isFinal) {
              return [...prev.filter(t => t.isFinal), data]
            }
            // For interim, replace the last interim or add new
            const withoutLastInterim = prev.filter(t => t.isFinal)
            return [...withoutLastInterim, data]
          })

          // Auto-scroll to bottom
          setTimeout(() => {
            const container = document.getElementById('transcript-container')
            if (container) {
              container.scrollTop = container.scrollHeight
            }
          }, 50)
        } else if (data.type === 'summary') {
          console.log('[Summary] Received live summary update:', data.summary)
          setSummaryUpdating(true)
          setLiveSummary(data.summary)

          // If it's the final summary, also update the meeting object
          if (data.isFinal) {
            console.log('[Summary] Received final summary - meeting completed')
            setMeeting(prev => prev ? {
              ...prev,
              summary: JSON.stringify(data.summary)
            } : prev)
          }

          // Clear "updating" indicator after animation
          setTimeout(() => setSummaryUpdating(false), 1000)
        } else if (data.type === 'status') {
          console.log('[Status] Received status update:', data.status)
          console.log('   Current status:', meeting?.status, '→ New status:', data.status)
          setMeeting(prev => {
            if (!prev) return prev
            const updated = { ...prev, status: data.status }
            console.log('   Meeting state updated, new status:', updated.status)
            return updated
          })
        } else if (data.type === 'error') {
          console.error('Stream error:', data.message)
        } else if (data.type === 'connected') {
          console.log('Stream connection established')
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      setStreamConnected(false)
      eventSource.close()
    }

    // Cleanup
    return () => {
      console.log('[Stream] Closing live transcription stream')
      eventSource.close()
    }
  }, [meeting?.status, params.id])

  // Poll for transcripts when meeting is processing or completed
  useEffect(() => {
    if (!meeting) return

    const shouldPoll = meeting.status === 'processing' || meeting.status === 'completed'
    if (!shouldPoll) return

    let lastFetchTimestamp = Date.now()

    const pollTranscripts = async () => {
      try {
        const url = `/api/meetings/${params.id}/transcripts?since=${lastFetchTimestamp}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data.transcripts && data.transcripts.length > 0) {
            console.log(`[Transcript] Received ${data.transcripts.length} new transcript(s)`)
            lastFetchTimestamp = data.timestamp

            setMeeting(prev => {
              if (!prev) return prev
              return {
                ...prev,
                transcripts: [...prev.transcripts, ...data.transcripts]
              }
            })
            setNewTranscriptsCount(prev => prev + data.transcripts.length)

            setTimeout(() => {
              const transcriptContainer = document.getElementById('transcript-container')
              if (transcriptContainer) {
                transcriptContainer.scrollTop = transcriptContainer.scrollHeight
              }
            }, 100)
          }
        }
      } catch (error) {
        console.error('Error polling transcripts:', error)
      }
    }

    pollTranscripts()
    const interval = setInterval(pollTranscripts, 3000)
    return () => clearInterval(interval)
  }, [meeting?.status, params.id])

  const fetchMeeting = async () => {
    try {
      const response = await fetch(`/api/meetings/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setMeeting(data)
      } else {
        alert('Meeting not found')
        router.push('/')
      }
    } catch (error) {
      console.error('Error fetching meeting:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartBot = async () => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/meetings/${params.id}/start-bot`, {
        method: 'POST',
      })
      if (response.ok) {
        await fetchMeeting()
        alert('Bot started successfully!')
      } else {
        alert('Failed to start bot')
      }
    } catch (error) {
      console.error('Error starting bot:', error)
      alert('Error starting bot')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStopBot = async () => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/meetings/${params.id}/stop-bot`, {
        method: 'POST',
      })
      if (response.ok) {
        await fetchMeeting()
        alert('Bot stopped successfully!')
      } else {
        alert('Failed to stop bot')
      }
    } catch (error) {
      console.error('Error stopping bot:', error)
      alert('Error stopping bot')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateSummary = async () => {
    setSummaryLoading(true)
    try {
      const response = await fetch(`/api/meetings/${params.id}/summary`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setMeeting(prev => prev ? { ...prev, summary: data.summary } : prev)
        alert('Summary generated successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate summary')
      }
    } catch (error) {
      console.error('Error generating summary:', error)
      alert('Error generating summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  const getStatusVariant = (status: string): 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed' | 'default' => {
    const validStatuses = ['scheduled', 'recording', 'processing', 'completed', 'failed'] as const
    return validStatuses.includes(status as any) ? status as any : 'default'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="animate-pulse">
            <CardBody className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">Loading meeting...</p>
            </CardBody>
          </Card>
        </div>
      </main>
    )
  }

  if (!meeting) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6 group transition-colors"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to meetings
        </Link>

        <div className="space-y-6 animate-slide-up">
          <Card>
            <CardBody>
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {meeting.title}
                    </h1>
                    <Badge variant={getStatusVariant(meeting.status)}>
                      {meeting.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-3 flex-shrink-0 ml-4">
                  {meeting.status === 'scheduled' && (
                    <Button
                      onClick={handleStartBot}
                      variant="success"
                      size="md"
                      isLoading={actionLoading}
                    >
                      {actionLoading ? 'Starting...' : 'Start Bot'}
                    </Button>
                  )}
                  {meeting.status === 'recording' && (
                    <Button
                      onClick={handleStopBot}
                      variant="danger"
                      size="md"
                      isLoading={actionLoading}
                    >
                      {actionLoading ? 'Stopping...' : 'Stop Bot'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Zoom Join URL</p>
                  <a
                    href={meeting.zoomJoinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 break-all"
                  >
                    {meeting.zoomJoinUrl}
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-gray-900 font-semibold">
                    {meeting.duration ? `${Math.floor(meeting.duration / 60)} minutes` : 'Not started'}
                  </p>
                </div>
              </div>

              {meeting.status === 'scheduled' && (
                <div className="mt-6 bg-blue-50 border-2 border-blue-200 p-4 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-900">
                    Click "Start Bot" to have the AI join this meeting and begin recording and transcription.
                  </p>
                </div>
              )}

              {meeting.status === 'recording' && (
                <div className="mt-6 bg-green-50 border-2 border-green-200 p-4 rounded-lg flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-5 h-5 bg-green-600 rounded-full animate-pulse"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-green-900 font-medium">
                      {streamConnected ? 'Live transcription active' : 'Bot is currently recording this meeting'}
                    </p>
                    <p className="text-xs text-green-800 mt-1">
                      {streamConnected
                        ? 'Transcripts are appearing in real-time below. Click "Stop Bot" to end the recording.'
                        : 'Connecting to live transcription stream...'}
                    </p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">
                  Participants
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({meeting.participants.length})
                  </span>
                </h2>
              </CardHeader>
              <CardBody>
                {meeting.participants.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No participants yet</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {meeting.participants.map((participant) => (
                      <li key={participant.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-white">
                            {participant.name[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-gray-900 font-medium">{participant.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">
                  Action Items
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({meeting.actionItems.length})
                  </span>
                </h2>
              </CardHeader>
              <CardBody>
                {meeting.actionItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No action items yet</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {meeting.actionItems.map((item) => (
                      <li key={item.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        {item.assignedTo && (
                          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {item.assignedTo}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Live Summary Section */}
          {(meeting.status === 'recording' || displaySummary || meeting.summary) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {meeting.status === 'recording' ? 'Live Summary' : 'AI Summary'}
                  </h2>
                  {meeting.status === 'recording' && summaryUpdating && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <span>Updating...</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {displaySummary ? (
                  <div className="space-y-6">
                    {/* Main Topics */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        Main Topics
                      </h3>
                      {(displaySummary?.topics?.length ?? 0) > 0 ? (
                        <ul className="space-y-2">
                          {displaySummary.topics.map((topic, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-purple-600 mt-1">•</span>
                              <span className="text-gray-700 flex-1">{topic}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No topics identified yet...</p>
                      )}
                    </div>

                    {/* Key Decisions */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Key Decisions
                      </h3>
                      {(displaySummary?.decisions?.length ?? 0) > 0 ? (
                        <ul className="space-y-2">
                          {displaySummary.decisions.map((decision, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-600 mt-1">✓</span>
                              <span className="text-gray-700 flex-1">{decision}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No decisions made yet...</p>
                      )}
                    </div>

                    {/* Action Items */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Action Items
                      </h3>
                      {(displaySummary?.actionItems?.length ?? 0) > 0 ? (
                        <ul className="space-y-2">
                          {displaySummary.actionItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-1">→</span>
                              <span className="text-gray-700 flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No action items yet...</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No summary available yet</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {(meeting.transcripts.length > 0 || liveTranscripts.length > 0) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {meeting.status === 'recording' ? 'Live Transcript' : 'Transcript'}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({(meeting.transcripts.length + liveTranscripts.filter(t => t.isFinal).length)} segments)
                    </span>
                  </h2>
                  {meeting.status === 'recording' && streamConnected && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                      <span>Live</span>
                    </div>
                  )}
                  {meeting.status === 'processing' && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                <div
                  id="transcript-container"
                  className="space-y-4 max-h-96 overflow-y-auto scroll-smooth"
                >
                  {/* Show saved transcripts */}
                  {meeting.transcripts.map((transcript, index) => (
                    <div
                      key={transcript.id}
                      className={`border-b border-gray-100 pb-4 last:border-0 ${
                        index >= meeting.transcripts.length - newTranscriptsCount ? 'animate-slide-up' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">{transcript.speaker}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {Math.floor(transcript.timestamp / 60)}:{String(transcript.timestamp % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-gray-700">{transcript.text}</p>
                    </div>
                  ))}

                  {/* Show live transcripts during recording */}
                  {meeting.status === 'recording' && liveTranscripts.map((transcript, index) => (
                    <div
                      key={`live-${index}`}
                      className={`border-b border-gray-100 pb-4 last:border-0 ${
                        transcript.isFinal ? '' : 'opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">
                          {transcript.speaker || 'Speaker'}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {Math.floor(transcript.timestamp / 60)}:{String(Math.floor(transcript.timestamp % 60)).padStart(2, '0')}
                        </span>
                        {!transcript.isFinal && (
                          <span className="text-xs text-blue-600 italic">interim</span>
                        )}
                      </div>
                      <p className={`${transcript.isFinal ? 'text-gray-700' : 'text-gray-600 italic'}`}>
                        {transcript.text}
                      </p>
                    </div>
                  ))}

                  {/* Show placeholder when recording but no transcripts yet */}
                  {meeting.status === 'recording' && liveTranscripts.length === 0 && streamConnected && (
                    <div className="text-center py-8">
                      <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-green-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm">Listening for speech...</p>
                      <p className="text-xs text-gray-400 mt-1">Transcripts will appear here as people speak</p>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
