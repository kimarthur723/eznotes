'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

type Meeting = {
  id: string
  title: string
  status: string
  scheduledAt: string | null
  startedAt: string | null
  createdAt: string
  _count: {
    participants: number
    actionItems: number
  }
}

export default function Home() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meetings')
      .then(res => res.json())
      .then(data => {
        setMeetings(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching meetings:', err)
        setLoading(false)
      })
  }, [])

  const getStatusVariant = (status: string): 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed' | 'default' => {
    const validStatuses = ['scheduled', 'recording', 'processing', 'completed', 'failed'] as const
    return validStatuses.includes(status as any) ? status as any : 'default'
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Your Meetings
          </h1>
          <p className="text-lg text-gray-600">
            Manage and review all your AI-powered meeting recordings
          </p>
        </div>

        {loading ? (
          <Card className="animate-pulse">
            <CardBody className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">Loading meetings...</p>
            </CardBody>
          </Card>
        ) : meetings.length === 0 ? (
          <Card className="animate-slide-up">
            <CardBody className="text-center py-20">
              <div className="mb-6">
                <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">No meetings yet</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Get started by scheduling your first AI-powered meeting bot to join and transcribe your calls.
              </p>
              <Link href="/meetings/new">
                <Button size="lg">
                  Schedule Your First Meeting
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4 animate-slide-up">
            {meetings.map((meeting, index) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                style={{ animationDelay: `${index * 50}ms` }}
                className="block animate-fade-in"
              >
                <Card hover>
                  <CardBody className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold text-gray-900 truncate">
                          {meeting.title}
                        </h3>
                        <Badge variant={getStatusVariant(meeting.status)}>
                          {meeting.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-5 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span>{meeting._count.participants} participants</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <span>{meeting._count.actionItems} action items</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(meeting.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <svg
                      className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
