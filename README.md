# EZ Notes - AI Meeting Intelligence System

AI-powered meeting bot that joins Zoom, Google Meet, and Microsoft Teams meetings, transcribes in real-time, and generates smart action items.

---

## Features

### Web UI
- **Home page** - List all meetings with status badges
- **New meeting form** - Add meeting URL and start recording
- **Meeting detail page** - Control bot, view live transcripts & action items
- **Auto-stop** - Bot automatically stops when meeting ends (no extra charges)

### API Endpoints
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

# 3. Configure environment
cp .env.example .env

# 4. (Optional) Set up ngrok for webhooks
ngrok http 3000
# Copy the HTTPS URL to NEXT_PUBLIC_APP_URL in .env

# 5. Run dev server
npm run dev
```

Visit http://localhost:3000

---

## Project Structure

```
eznotes/
├── app/
│   ├── api/
│   │   ├── meetings/          # Meeting CRUD endpoints
│   │   └── webhooks/
│   │       └── meetingbaas/   # MeetingBaas webhook handlers
│   ├── meetings/              # Meeting pages (new, detail)
│   ├── layout.tsx             # Root layout with Header
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
├── components/
│   ├── ui/                    # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   └── Card.tsx
│   └── Header.tsx             # Navigation header
├── lib/
│   ├── prisma.ts              # Database client
│   ├── zoom/client.ts         # Zoom API (optional)
│   └── meetingbaas/client.ts  # MeetingBaas API client
├── services/
│   └── bot-service.ts         # Bot lifecycle (MeetingBaas)
├── prisma/
│   └── schema.prisma          # Database models
├── FIX_BLOCKING_ISSUES.md     # READ THIS FIRST
└── SETUP.md                   # Detailed setup guide
```

---

## Required API Keys

1. **MeetingBaas** (https://meetingbaas.com) - **REQUIRED**
   - Sign up for an account
   - Get: API key from dashboard
   - Configure webhooks (see MEETINGBAAS_SETUP.md)

2. **OpenAI** (https://platform.openai.com) - For action item extraction (Phase 2)
   - Create account
   - Get: API key (GPT-4 access recommended)

Add all to `.env` file:
```env
MEETINGBAAS_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

