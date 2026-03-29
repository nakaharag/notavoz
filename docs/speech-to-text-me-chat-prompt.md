# Chat Prompt for Building speech-to-text.me

Copy and paste this prompt into a new Claude Code session:

---

## Prompt

```
I want to build a web application called speech-to-text.me

## What it does
A public login with social media based web app where users can:
1. Record audio in the browser
2. Get AI transcription (OpenAI Whisper)
3. Get AI-generated summary (Claude)
4. Share the results (copy, link, social media)
5. need to limit to 15 seconds at first

## Tech Stack
- Frontend: React 18
- Backend: NestJS
- Speech-to-Text: OpenAI Whisper API
- AI Summary: Anthropic Claude API
- Storage: JSON files with 24h expiry
- Deployment: Docker + Coolify

## Key Features

### Social media authentication
- Rate limit by IP (5 transcriptions/day free)

### Core Flow
1. User clicks "Record" button
2. Audio is sent to backend
3. Whisper transcribes to text
4. Claude corrects and summarizes
5. User can copy/share results

### Share System
- Generate short links: speech-to-text.me/s/abc123
- Copy to clipboard
- Share to X, Facebook, WhatsApp
- Links expire after 24 hours

### Ads Integration
- Google AdSense
- Top and bottom banner ads
- Non-intrusive placement

## API Endpoints
POST /speech/transcribe - Upload audio, get transcript
POST /content/summarize - Get AI summary
POST /share/create - Create shareable link (returns short ID)
GET /share/:id - Get shared content

## UI Layout
- Single page, centered
- Large record button at top
- Transcript box below
- Summary box below that
- Share buttons at bottom
- Ad banners top and bottom

## Style
- Modern, minimal design
- Primary color: #3B82F6 (blue)
- Clean typography (Inter or similar)
- Mobile responsive
- Dark mode support (optional)

## Environment Variables Needed
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
NODE_ENV=production
CORS_ORIGIN=https://speech-to-text.me

## Project Structure
speech-to-text-me/
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   │   ├── Recorder.js
│   │   │   ├── Transcript.js
│   │   │   ├── Summary.js
│   │   │   ├── SharePanel.js
│   │   │   └── AdBanner.js
│   │   └── styles.css
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md

Please create this project step by step. Start with the backend, then frontend, then Docker setup.
```

---

## Follow-up Prompts

After the initial build, use these to add features:

### Add Rate Limiting
```
Add IP-based rate limiting to the backend:
- Max 10 transcriptions per day per IP
- Max 10 summaries per day per IP
- Return 429 status when limit reached
- Reset at midnight UTC
```

### Add Share Analytics
```
Add simple analytics to track shares:
- Count views per shared link
- Track share button clicks (twitter, facebook, etc.)
- Store in JSON file
```

### Add Dark Mode
```
Add dark mode toggle to the frontend:
- Use CSS variables for colors
- Save preference in localStorage
- Default to system preference
```

### Add Language Selection
```
Add language selection for transcription:
- Dropdown with common languages
- Auto-detect option
- Pass language hint to Whisper API
```

### Add Audio File Upload
```
Add ability to upload audio files (not just record):
- Accept mp3, wav, m4a, webm
- Max file size 25MB
- Same processing flow as recorded audio
```
