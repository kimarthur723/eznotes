import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { meetingBaasClient } from '@/lib/meetingbaas/client'

/**
 * Get live transcripts for a meeting
 * This endpoint can be polled by the frontend to show real-time transcripts
 *
 * For live meetings, fetches transcripts from MeetingBaas API in real-time
 * For completed meetings, returns transcripts from database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') // Timestamp to get transcripts after
    const limit = parseInt(searchParams.get('limit') || '100')

    const meetingId = id

    // Get meeting status to determine if we should poll MeetingBaas
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, zoomMeetingId: true }
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Note: MeetingBaas does not provide an API to fetch partial transcripts during a meeting
    // Transcripts are only available after the meeting completes via webhook
    // The live polling still works to fetch transcripts as soon as they arrive from the webhook

    // Build query for database transcripts
    const where: any = { meetingId }

    if (since) {
      where.createdAt = {
        gt: new Date(parseInt(since))
      }
    }

    const transcripts = await prisma.transcript.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: limit,
    })

    return NextResponse.json({
      transcripts,
      timestamp: Date.now(), // For next poll
    })
  } catch (error) {
    console.error('Error fetching transcripts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcripts' },
      { status: 500 }
    )
  }
}
