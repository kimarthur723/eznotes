import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openaiService } from '@/lib/openai/client'

/**
 * Generate AI summary for a meeting
 *
 * POST /api/meetings/[id]/summary
 * - Fetches all transcripts for the meeting
 * - Generates a summary using OpenAI
 * - Saves summary to the meeting record
 * - Returns the generated summary
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params

    // Fetch meeting with transcripts
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcripts: {
          orderBy: { timestamp: 'asc' }
        }
      }
    })

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Check if there are transcripts to summarize
    if (!meeting.transcripts || meeting.transcripts.length === 0) {
      return NextResponse.json(
        { error: 'No transcripts available to summarize' },
        { status: 400 }
      )
    }

    console.log(`[Summary] Generating summary for meeting ${meetingId} with ${meeting.transcripts.length} transcript segments...`)

    // Generate summary using OpenAI
    const summary = await openaiService.generateSummary(
      meeting.transcripts.map(t => ({
        speaker: t.speaker || 'Unknown',
        text: t.text,
        timestamp: t.timestamp
      }))
    )

    // Save summary to database
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { summary }
    })

    console.log(`[Summary] Generated successfully for meeting ${meetingId}`)

    return NextResponse.json({
      success: true,
      summary,
      transcriptCount: meeting.transcripts.length
    })
  } catch (error: any) {
    console.error('[Summary] Error generating summary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

/**
 * Get existing summary for a meeting
 *
 * GET /api/meetings/[id]/summary
 * - Returns the saved summary if it exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        _count: {
          select: {
            transcripts: true
          }
        }
      }
    })

    if (!meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      meetingId: meeting.id,
      title: meeting.title,
      summary: meeting.summary,
      hasSummary: !!meeting.summary,
      transcriptCount: meeting._count.transcripts,
      status: meeting.status
    })
  } catch (error: any) {
    console.error('[Summary] Error fetching summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    )
  }
}
