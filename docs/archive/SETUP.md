# EZ Notes - Setup Guide

AI Meeting Intelligence System that joins Zoom meetings, transcribes, and generates smart action items.

## Prerequisites

- **Node.js >= 20.9.0** (your current version 20.0.0 needs upgrading)
- npm or yarn
- Zoom account with API access
- Deepgram API key (for transcription)
- OpenAI API key (for AI analysis)

## Step 1: Fix Node.js Version

Your current Node.js is 20.0.0, but Next.js requires >= 20.9.0.

```bash
# Using nvm (recommended)
nvm install 20.9.0
nvm use 20.9.0

# Or download from https://nodejs.org
```

## Step 2: Install Dependencies

```bash
npm install

# Install Prisma and additional packages
npm install prisma @prisma/client
npm install @deepgram/sdk openai

# Install Zoom SDK (when implementing bot)
# npm install @zoom/meetingsdk
```

## Step 3: Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Create database
npx prisma db push

# Optional: Open Prisma Studio to view data
npx prisma studio
```

## Step 4: Configure Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

### Get Zoom API Credentials

1. Go to https://marketplace.zoom.us/develop/create
2. Create a **Server-to-Server OAuth** app
3. Add scopes:
   - `meeting:write`
   - `meeting:read`
   - `recording:write`
4. Copy your credentials:
   - Account ID
   - Client ID
   - Client Secret
5. Add them to `.env`

### Get Deepgram API Key

1. Sign up at https://deepgram.com
2. Get your API key from dashboard
3. Add to `.env` as `DEEPGRAM_API_KEY`

### Get OpenAI API Key

1. Sign up at https://platform.openai.com
2. Create an API key
3. Add to `.env` as `OPENAI_API_KEY`

## Step 5: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Project Structure

```
eznotes/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── meetings/      # Meeting endpoints
│   ├── meetings/          # Meeting pages
│   └── page.tsx           # Home page
├── lib/                   # Utilities
│   ├── prisma.ts          # Database client
│   └── zoom/              # Zoom integration
│       └── client.ts      # Zoom API client
├── services/              # Business logic
│   └── bot-service.ts     # Bot lifecycle management
├── prisma/                # Database schema
│   └── schema.prisma      # Database models
└── components/            # React components (future)
```

## Current Status (Phase 1)

✅ **Completed:**
- Next.js + TypeScript project setup
- Database schema (Users, Meetings, Participants, Transcripts, Action Items)
- UI pages (Home, New Meeting, Meeting Detail)
- API endpoints for creating meetings
- Zoom client structure
- Bot service structure

🚧 **TODO (Phase 2-4):**
- [ ] Implement actual Zoom bot joining (using SDK or third-party service)
- [ ] Audio recording and storage
- [ ] Real-time transcription with Deepgram
- [ ] Action item extraction with GPT-4
- [ ] Search functionality
- [ ] Email generation

## Implementation Notes

### Zoom Bot Approaches

Since Zoom doesn't have a simple "bot joins meeting" API, you have 3 options:

**Option 1: Zoom Meeting SDK** (Complex)
- Use Zoom Meeting SDK for Web
- Requires headless browser (Puppeteer/Playwright)
- Full control over bot

**Option 2: Third-Party Service** (Easiest for MVP)
- Use services like:
  - Recall.ai (https://recall.ai)
  - Fireflies.ai API
  - Otter.ai API
- They handle joining, recording, transcription
- Just integrate their webhooks

**Option 3: Manual Recording** (Simplest for testing)
- Skip bot entirely for now
- Upload recorded meeting files manually
- Process them with Deepgram + GPT-4
- Good for testing the processing pipeline

For the 4-day timeline, **Option 2 or 3 is recommended**.

## Next Steps

1. **Fix Node version** (blocking issue)
2. **Set up environment variables**
3. **Run the app** and test UI
4. **Choose bot approach** (recommend Option 2 or 3)
5. **Implement transcription** (Day 2-3)
6. **Implement AI analysis** (Day 3-4)

## Troubleshooting

### WSL Path Issues

If you see "UNC paths are not supported" errors:

```bash
# Make sure you're in a Linux path, not Windows path
cd ~
cd eznotes
pwd  # Should show /home/user/eznotes, not \\wsl...
```

### Database Connection Issues

```bash
# Reset database
rm prisma/dev.db
npx prisma db push
```

## Questions?

Check the Zoom SDK docs: https://developers.zoom.us
