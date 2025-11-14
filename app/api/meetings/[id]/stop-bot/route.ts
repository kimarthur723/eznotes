import { NextRequest, NextResponse } from 'next/server'
import { botService } from '@/services/bot-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const meetingId = id

    const result = await botService.stopBot(meetingId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error stopping bot:', error)
    return NextResponse.json(
      { error: 'Failed to stop bot' },
      { status: 500 }
    )
  }
}
