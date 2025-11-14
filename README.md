# EZ Notes - AI Meeting Intelligence System

AI-powered meeting bot that joins Zoom, Google Meet, and Microsoft Teams meetings, transcribes in real-time, and generates smart action items.

---

## API Endpoints
- `POST /api/meetings` - Create new meeting
- `GET /api/meetings` - List meetings
- `GET /api/meetings/[id]` - Get meeting details
- `POST /api/meetings/[id]/start-bot` - Start MeetingBaas bot
- `POST /api/meetings/[id]/stop-bot` - Manually stop bot
- `POST /api/webhooks/meetingbaas/events` - Receive bot events (auto-stop)
- `POST /api/webhooks/meetingbaas/transcript` - Receive transcripts

### Core Services
- **MeetingBaas Client** - API integration for joining meetings
- **Bot Service** - Meeting lifecycle management (join, record, process)
- **Webhook Handlers** - Real-time event processing and auto-stop

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up database
npx prisma generate
npx prisma db push

# 3. Configure environment in .env

# 4. (Optional) Set up ngrok for webhooks
ngrok http 3000
# Copy the HTTPS URL to NEXT_PUBLIC_APP_URL in .env

# 5. Run dev server
npm run dev
```

Visit http://localhost:3000

---

## Required API Keys

1. **MeetingBaas** (https://meetingbaas.com)

2. **OpenAI** (https://platform.openai.com)

Add all to `.env` file:
```env
MEETINGBAAS_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---


