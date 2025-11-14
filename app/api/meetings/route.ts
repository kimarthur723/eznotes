import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, zoomJoinUrl } = body

    // For MVP, we'll use a hardcoded test user
    // In production, you'd get this from the session
    let user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User'
        }
      })
    }

    const meeting = await prisma.meeting.create({
      data: {
        title,
        zoomJoinUrl,
        status: 'scheduled',
        userId: user.id,
      },
    })

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // For MVP, get all meetings for the test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })

    if (!user) {
      return NextResponse.json([])
    }

    const meetings = await prisma.meeting.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            participants: true,
            actionItems: true,
          }
        }
      }
    })

    return NextResponse.json(meetings)
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    )
  }
}
