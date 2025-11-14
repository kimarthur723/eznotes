# Deepgram Live Transcription Integration

## Overview

The system uses Deepgram's live streaming API for real-time transcription during meetings. This provides:
- ⚡ Real-time transcription as people speak (~300ms latency)
- 🎤 Speaker diarization (who said what)
- 📝 Automatic punctuation and formatting
- 🔍 High accuracy with Nova-2 model

---

## How It Works

### 1. **Meeting Starts** (User clicks "Start Bot")
```
User → Frontend → POST /api/meetings/[id]/start-bot
         ↓
    Bot Service:
    - Updates meeting status to "recording"
    - Opens WebSocket connection to Deepgram
    - Starts Zoom bot (TODO: needs actual implementation)
```

### 2. **Live Transcription** (During Meeting)
```
Audio Stream:
Zoom Bot → Audio Chunks → Deepgram WebSocket
                              ↓
                        Live Transcription
                              ↓
                      Transcript Segments
                              ↓
                       Database (Prisma)
```

**Code Flow:**
```typescript
// services/bot-service.ts
const deepgramConnection = await deepgramService.startLiveTranscription(meetingId)

// When audio chunks arrive:
deepgramConnection.send(audioChunk) // Stream to Deepgram

// Deepgram automatically:
// 1. Transcribes audio in real-time
// 2. Calls onTranscript callback
// 3. Saves to database via DeepgramService
```

### 3. **Frontend Live Updates** (UI Polling)
```
Frontend (every 2 seconds):
GET /api/meetings/[id]/transcripts?since=<timestamp>
         ↓
  Returns new transcripts
         ↓
  UI updates in real-time
```

### 4. **Meeting Ends** (User clicks "Stop Bot")
```
User → Frontend → POST /api/meetings/[id]/stop-bot
         ↓
    Bot Service:
    - Closes Deepgram connection
    - Updates meeting status to "processing"
    - Triggers AI analysis (GPT-4 for action items)
    - Updates status to "completed"
```

---

## File Structure

### Core Files
```
services/
├── transcription/
│   └── deepgram-service.ts     # Deepgram WebSocket & API integration
├── bot-service.ts               # Bot lifecycle + transcription orchestration

app/api/meetings/
├── [id]/
│   ├── start-bot/route.ts      # Start recording + transcription
│   ├── stop-bot/route.ts       # Stop recording + trigger processing
│   └── transcripts/route.ts    # Get live transcripts (for polling)

app/meetings/[id]/page.tsx       # UI with live transcript polling
```

---

## Key Components

### DeepgramService (`services/transcription/deepgram-service.ts`)

**Responsibilities:**
- Manage Deepgram WebSocket connections
- Handle real-time transcript events
- Save transcript segments to database
- Format transcripts for display

**Main Methods:**
```typescript
// Start live transcription
startLiveTranscription(meetingId, options)

// Transcribe pre-recorded file (for testing)
transcribeFile(audioFilePath)

// Get all transcripts for a meeting
getMeetingTranscript(meetingId)

// Format for UI
formatTranscript(transcripts)
```

**Configuration:**
```typescript
{
  model: 'nova-2',           // Latest Deepgram model
  language: 'en-US',
  smart_format: true,        // Auto punctuation
  punctuate: true,
  diarize: true,             // Speaker identification
  interim_results: true,     // Get partial results
  utterance_end_ms: 1000,    // Wait 1s before finalizing
  vad_events: true,          // Voice activity detection
  encoding: 'linear16',
  sample_rate: 16000,
}
```

### BotService Updates

**New Features:**
- Tracks active Deepgram connections per meeting
- Automatically starts transcription when bot starts
- Closes connections when bot stops
- Triggers post-processing after meeting ends

**Key Code:**
```typescript
// Store active connections
private activeConnections: Map<string, LiveClient>

// Start transcription
const deepgramConnection = await deepgramService.startLiveTranscription(
  meetingId,
  {
    onTranscript: (transcript) => {
      console.log(`[${transcript.speaker}] ${transcript.text}`)
    }
  }
)

// Store for later cleanup
this.activeConnections.set(meetingId, deepgramConnection)

// When meeting ends
deepgramConnection.finish()
this.activeConnections.delete(meetingId)
```

---

## Database Schema

**Transcript Model:**
```prisma
model Transcript {
  id          String   @id @default(cuid())
  text        String   // Transcript text
  speaker     String?  // "Speaker 0", "Speaker 1", etc.
  timestamp   Int      // Seconds from meeting start
  confidence  Float?   // 0.0 to 1.0
  createdAt   DateTime @default(now())

  meetingId   String
  meeting     Meeting  @relation(...)
}
```

**Saved Automatically:**
- Every final transcript segment from Deepgram
- Speaker identification (if available)
- Timestamp relative to meeting start
- Confidence score

---

## API Endpoints

### `POST /api/meetings/[id]/start-bot`
Starts bot and begins live transcription.

**Request:** None
**Response:**
```json
{
  "success": true,
  "botId": "mock-bot-id"
}
```

### `POST /api/meetings/[id]/stop-bot`
Stops bot, closes Deepgram connection, triggers processing.

**Request:** None
**Response:**
```json
{
  "success": true
}
```

### `GET /api/meetings/[id]/transcripts?since=<timestamp>`
Gets new transcripts since a given time (for polling).

**Query Params:**
- `since` (optional): Timestamp in milliseconds
- `limit` (optional): Max results (default 100)

**Response:**
```json
{
  "transcripts": [
    {
      "id": "...",
      "text": "Let's discuss the Q4 roadmap",
      "speaker": "Speaker 0",
      "timestamp": 42,
      "confidence": 0.98,
      "createdAt": "2025-01-06T..."
    }
  ],
  "timestamp": 1704499200000
}
```

---

## Frontend Integration

### Live Transcript Polling

**In `app/meetings/[id]/page.tsx`:**

```typescript
// Poll every 2 seconds when meeting is recording
useEffect(() => {
  if (!meeting || meeting.status !== 'recording') return

  const pollTranscripts = async () => {
    const url = `/api/meetings/${id}/transcripts?since=${lastTime}`
    const response = await fetch(url)
    const data = await response.json()

    // Append new transcripts
    setMeeting(prev => ({
      ...prev,
      transcripts: [...prev.transcripts, ...data.transcripts]
    }))
  }

  const interval = setInterval(pollTranscripts, 2000)
  return () => clearInterval(interval)
}, [meeting?.status])
```

**Why Polling Instead of WebSockets?**
- Simpler implementation for MVP
- Works with serverless/edge deployments
- Good enough for 2-second refresh rate
- Can upgrade to WebSockets later if needed

---

## Environment Setup

### Required Environment Variable

```bash
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

**Get Your Key:**
1. Sign up at https://deepgram.com
2. Create a new project
3. Go to API Keys section
4. Create a new key with "Member" permissions
5. Copy and add to `.env`

**Pricing:**
- Free tier: $200 credit
- Pay-as-you-go: ~$0.0043/minute (~$0.26/hour)
- Nova-2 model (best accuracy)

---

## TODO: Audio Streaming

**Current Gap:**
The system has Deepgram integration, but **doesn't actually stream audio yet** because we don't have a real Zoom bot implementation.

**Options to Complete:**

### Option 1: Use Recall.ai (Recommended)
```typescript
// Recall.ai handles joining + recording
// Just get webhook with audio/transcript
// Easiest for 4-day timeline
```

### Option 2: Zoom Meeting SDK
```typescript
// Run headless browser with Zoom SDK
// Capture audio stream
// Send to Deepgram:
deepgramConnection.send(audioChunk)
```

### Option 3: Manual Upload (Testing)
```typescript
// For testing without a bot:
const result = await deepgramService.transcribeFile('meeting.wav')
// Manually save to database
```

---

## Testing Deepgram Integration

### Test Without Zoom Bot

1. **Record a test meeting** (or download sample audio)

2. **Use the file transcription endpoint:**
```typescript
import { deepgramService } from '@/services/transcription/deepgram-service'

const result = await deepgramService.transcribeFile('./test-meeting.wav')
console.log(result)
```

3. **Check database:**
```bash
npx prisma studio
# Check Transcript table
```

### Test Live Transcription (Mock)

```typescript
// In a test script:
const connection = await deepgramService.startLiveTranscription('test-meeting-id')

// Simulate streaming audio
const audioStream = fs.createReadStream('test-meeting.wav')
audioStream.on('data', (chunk) => {
  connection.send(chunk)
})

// After a few seconds, check database for transcripts
```

---

## Troubleshooting

### No Transcripts Appearing

1. Check Deepgram API key is set
2. Check meeting status is "recording"
3. Check database for Transcript entries
4. Check browser console for polling errors

### Low Accuracy

- Ensure audio quality is good (16kHz+)
- Check speaker is speaking clearly
- Try different Deepgram model
- Enable noise reduction in config

### High Costs

- Monitor usage in Deepgram dashboard
- Consider using Whisper-1 model (cheaper, batch only)
- Implement usage limits per meeting
- Cache transcripts aggressively

---

## Next Steps

1. **Implement actual Zoom bot** (choose Option 1, 2, or 3 above)
2. **Stream audio to Deepgram** via `deepgramConnection.send()`
3. **Test end-to-end** with a real meeting
4. **Add GPT-4 action items** (Day 3-4)
5. **Polish UI** for live transcripts

The infrastructure is ready - just needs the bot to provide audio!
