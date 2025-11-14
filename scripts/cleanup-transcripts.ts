import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupTranscripts() {
  try {
    console.log('🧹 Cleaning up misplaced transcripts...')

    // Get the first meeting (where all transcripts went)
    const firstMeeting = await prisma.meeting.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { transcripts: true }
        }
      }
    })

    if (!firstMeeting) {
      console.log('No meetings found')
      return
    }

    console.log(`Found first meeting: ${firstMeeting.id}`)
    console.log(`  Title: ${firstMeeting.title}`)
    console.log(`  Status: ${firstMeeting.status}`)
    console.log(`  Transcripts: ${firstMeeting._count.transcripts}`)

    // Delete all transcripts from the first meeting
    const deleted = await prisma.transcript.deleteMany({
      where: { meetingId: firstMeeting.id }
    })

    console.log(`✅ Deleted ${deleted.count} transcripts from meeting ${firstMeeting.id}`)

    // Reset the meeting status
    await prisma.meeting.update({
      where: { id: firstMeeting.id },
      data: {
        status: 'scheduled',
        zoomMeetingId: null
      }
    })

    console.log(`✅ Reset meeting ${firstMeeting.id} to scheduled status`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupTranscripts()
