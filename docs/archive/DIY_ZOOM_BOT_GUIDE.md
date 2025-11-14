# DIY Zoom Bot Implementation Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
├─────────────────────────────────────────────────────────────┤
│  User clicks "Start Bot"                                     │
│         ↓                                                    │
│  POST /api/meetings/[id]/start-bot                          │
│         ↓                                                    │
│  Bot Service (services/bot-service.ts)                      │
│         ↓                                                    │
│  Zoom Bot Manager (services/zoom-bot/zoom-bot-manager.ts)  │
│         ↓                                                    │
├─────────────────────────────────────────────────────────────┤
│               Headless Browser (Puppeteer)                   │
├─────────────────────────────────────────────────────────────┤
│  - Launches Chromium                                         │
│  - Loads Zoom Meeting SDK                                    │
│  - Joins meeting with bot credentials                        │
│  - Captures audio stream                                     │
│         ↓                                                    │
├─────────────────────────────────────────────────────────────┤
│                    Audio Processing                          │
├─────────────────────────────────────────────────────────────┤
│  Raw Audio → PCM Conversion → Chunks → Deepgram WebSocket  │
│                                              ↓               │
│                                     Live Transcription       │
│                                              ↓               │
│                                        Database (Prisma)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Zoom Meeting SDK Credentials

You need **different credentials** than the Server-to-Server OAuth:

1. Go to https://marketplace.zoom.us/develop/create
2. Create a **Meeting SDK** app (NOT Server-to-Server OAuth)
3. Choose **SDK App** type
4. Get your:
   - SDK Key (Client ID)
   - SDK Secret (Client Secret)
5. Add to `.env`:
   ```bash
   ZOOM_SDK_KEY=your_sdk_key
   ZOOM_SDK_SECRET=your_sdk_secret
   ```

### 2. Required npm Packages

```bash
npm install puppeteer puppeteer-stream @zoomus/websdk
npm install -D @types/node
```

**What each does:**
- `puppeteer` - Headless browser automation
- `puppeteer-stream` - Capture audio/video streams from browser
- `@zoomus/websdk` - Zoom Meeting SDK for Web

---

## Implementation Components

### Component 1: Zoom Bot Manager

**Purpose:** Manages the headless browser and Zoom SDK

**File:** `services/zoom-bot/zoom-bot-manager.ts`

**Responsibilities:**
- Launch headless browser
- Load Zoom Meeting SDK
- Join meeting
- Capture audio stream
- Handle errors and cleanup

### Component 2: Audio Stream Handler

**Purpose:** Processes raw audio and streams to Deepgram

**File:** `services/zoom-bot/audio-handler.ts`

**Responsibilities:**
- Receive audio chunks from browser
- Convert to PCM format (if needed)
- Buffer appropriately
- Stream to Deepgram WebSocket

### Component 3: Bot HTML Page

**Purpose:** The web page loaded in headless browser

**File:** `public/zoom-bot.html`

**Contains:**
- Zoom Meeting SDK initialization
- Join meeting logic
- Audio capture using Web Audio API
- Send audio to Node.js backend

---

## Audio Capture Flow

### Option A: Direct WebRTC Capture (Simpler)

```javascript
// In headless browser
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const mediaRecorder = new MediaRecorder(stream)

mediaRecorder.ondataavailable = (event) => {
  // Send audio chunk to backend
  sendToBackend(event.data)
}
```

### Option B: Web Audio API (More Control)

```javascript
// In headless browser
const audioContext = new AudioContext({ sampleRate: 16000 })
const source = audioContext.createMediaStreamSource(stream)
const processor = audioContext.createScriptProcessor(4096, 1, 1)

processor.onaudioprocess = (event) => {
  const audioData = event.inputBuffer.getChannelData(0)
  // Send PCM data to backend for Deepgram
  sendToBackend(audioData)
}
```

---

## Security Considerations

### Bot Authentication

The bot needs to join meetings. Two approaches:

**Approach 1: Meeting Passcode (If Available)**
```typescript
const joinUrl = `${meeting.zoomJoinUrl}?pwd=${passcode}`
```

**Approach 2: Pre-authorized Bot User**
- Create a dedicated Zoom user for the bot
- Bot "logs in" as this user
- Joins meetings as a participant

---

## Challenges & Solutions

### Challenge 1: Audio Permissions
**Problem:** Headless browser can't request microphone access

**Solution:** Use `--use-fake-device-for-media-stream` flag
```typescript
await puppeteer.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--no-sandbox',
  ]
})
```

### Challenge 2: Zoom SDK in Headless Mode
**Problem:** Zoom SDK expects user interaction

**Solution:** Automate all interactions:
```typescript
// Auto-accept permissions
await page.evaluate(() => {
  // Click "Join Audio" automatically
  document.querySelector('[aria-label="Join Audio"]')?.click()
})
```

### Challenge 3: Audio Format
**Problem:** Browser audio ≠ Deepgram format

**Solution:** Convert to PCM 16kHz mono:
```typescript
// In browser: downsample to 16kHz
const audioContext = new AudioContext({ sampleRate: 16000 })

// In backend: ensure buffer is correct format
const pcmBuffer = convertToPCM16(audioChunk)
deepgramConnection.send(pcmBuffer)
```

### Challenge 4: Multiple Speakers
**Problem:** Zoom mixes all audio into one stream

**Solution:**
- Deepgram's diarization handles this
- No need to separate speakers manually
- Deepgram will label speakers automatically

---

## Resource Management

### Browser Lifecycle

```typescript
class ZoomBotManager {
  private browsers: Map<string, Browser> = new Map()

  async startBot(meetingId: string) {
    const browser = await puppeteer.launch(...)
    this.browsers.set(meetingId, browser)
  }

  async stopBot(meetingId: string) {
    const browser = this.browsers.get(meetingId)
    await browser?.close()
    this.browsers.delete(meetingId)
  }
}
```

**Important:**
- One browser instance per meeting
- Always clean up on stop
- Handle crashes gracefully

---

## Development Workflow

### Phase 1: Basic Browser Launch
```typescript
// Test that you can launch browser
const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.goto('https://zoom.us/test')
await browser.close()
```

### Phase 2: Load Zoom SDK
```typescript
// Load your bot HTML page with Zoom SDK
await page.goto('http://localhost:3000/zoom-bot.html')
```

### Phase 3: Join Meeting
```typescript
// Automate joining a test meeting
await page.evaluate((meetingNumber, passcode) => {
  ZoomMtg.init({
    leaveUrl: 'http://localhost:3000',
    success: () => {
      ZoomMtg.join({
        meetingNumber,
        passcode,
        userName: 'EZ Notes Bot',
        // ...
      })
    }
  })
}, meetingNumber, passcode)
```

### Phase 4: Capture Audio
```typescript
// Set up audio capture
const stream = await page.evaluate(() => {
  return navigator.mediaDevices.getUserMedia({ audio: true })
})
```

### Phase 5: Stream to Deepgram
```typescript
// Connect everything
audioChunk => deepgramConnection.send(audioChunk)
```

---

## Testing Strategy

### 1. Test Locally First
- Create a personal Zoom meeting
- Start the bot
- Join from your computer
- Speak and verify transcription

### 2. Test Edge Cases
- Meeting with passcode
- Waiting room enabled
- Recording disabled meetings
- Network interruptions

### 3. Monitor Resources
```bash
# Check memory usage
ps aux | grep chrome

# Check number of processes
pgrep chrome | wc -l
```

---

## Production Considerations

### 1. Resource Limits
- Each bot = 1 browser instance = ~150-200MB RAM
- Limit concurrent bots (e.g., max 10)
- Use queue system for high demand

### 2. Error Recovery
```typescript
browser.on('disconnected', async () => {
  console.error('Browser crashed, restarting...')
  await this.restartBot(meetingId)
})
```

### 3. Logging
```typescript
// Log everything for debugging
console.log('[Bot] Joining meeting:', meetingId)
console.log('[Bot] Audio stream started')
console.log('[Bot] Transcript received:', text)
```

### 4. Cleanup
```typescript
// Always clean up, even on errors
try {
  await bot.join()
} finally {
  await bot.cleanup()
}
```

---

## Cost Analysis

### Development Time
- **Phase 1-2** (Browser + SDK): 4-6 hours
- **Phase 3** (Audio capture): 4-6 hours
- **Phase 4** (Deepgram integration): 2-3 hours
- **Phase 5** (Error handling): 3-4 hours
- **Total: 13-19 hours** (2-3 days)

### Runtime Costs
- **Compute:** ~$0.01/hour (modest server)
- **Deepgram:** ~$0.26/hour
- **Total: ~$0.27/hour per meeting**

vs. Recall.ai: $10-20/hour

**Savings:** ~$9.73-19.73/hour (36x-73x cheaper!)

---

## Next Steps

1. Create Zoom Meeting SDK app
2. Install Puppeteer dependencies
3. Build ZoomBotManager service
4. Create bot HTML page
5. Test with a simple meeting
6. Add audio capture
7. Connect to Deepgram
8. Polish and error handling

Ready to start building? I'll create the implementation files next!
