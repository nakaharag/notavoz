# speech-to-text.me - Project Instructions

## Overview

A public speech-to-text web application with AI summarization and sharing capabilities. Based on NotaVoz architecture but with different identity, no authentication, and monetization through ads.

---

## Core Features

1. **Voice Recording** - Record audio directly in browser
2. **Transcription** - OpenAI Whisper API (multi-language)
3. **AI Summarization** - Claude AI for text correction and summary
4. **Share** - Generate shareable links, copy to clipboard, social sharing
5. **Ads** - Google AdSense integration for monetization

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 |
| Backend | NestJS (Node.js) |
| Speech-to-Text | OpenAI Whisper |
| AI Processing | Claude AI (Anthropic) |
| Storage | JSON files (or Redis for ephemeral) |
| Ads | Google AdSense |
| Deployment | Docker + Coolify |

---

## Architecture Differences from NotaVoz

| Aspect | NotaVoz | speech-to-text.me |
|--------|---------|-------------------|
| Authentication | Required (fixed user/pass) | None |
| Target audience | Psychologists (PT-BR) | General public (EN) |
| Data persistence | Permanent patient records | Temporary (24h expiry) |
| Monetization | None | Google AdSense |
| Sharing | None | URL sharing, social, clipboard |
| Language | Portuguese | English (multi-language support) |

---

## Implementation Plan

### Phase 1: Core Setup

#### 1.1 Project Structure
```
speech-to-text-me/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Recorder.js
│   │   │   ├── Transcript.js
│   │   │   ├── Summary.js
│   │   │   ├── SharePanel.js
│   │   │   └── AdBanner.js
│   │   ├── App.js
│   │   └── styles.css
│   ├── public/
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── speech.controller.ts
│   │   │   ├── share.controller.ts
│   │   │   └── content.controller.ts
│   │   ├── services/
│   │   │   ├── speech.service.ts
│   │   │   ├── claude.service.ts
│   │   │   └── share.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

#### 1.2 Backend Implementation

**No Auth Required** - Remove AuthModule and guards

**API Endpoints:**
```
POST /speech/transcribe     - Upload audio, get transcript
POST /content/summarize     - Summarize text with Claude
POST /share/create          - Create shareable link
GET  /share/:id             - Get shared content
```

**Share Service:**
```typescript
// Share data structure
interface SharedContent {
  id: string;           // Short unique ID (nanoid)
  createdAt: string;
  expiresAt: string;    // 24h from creation
  transcript: string;
  summary: string;
  language: string;
}
```

#### 1.3 Frontend Implementation

**Single Page Flow:**
```
┌─────────────────────────────────────────┐
│  [AD BANNER - TOP]                      │
├─────────────────────────────────────────┤
│                                         │
│     speech-to-text.me                   │
│     "Record. Transcribe. Share."        │
│                                         │
│     ┌─────────────────────┐             │
│     │   🎤 RECORD         │             │
│     └─────────────────────┘             │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ Transcript                       │   │
│  │ [Your transcribed text here...] │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ Summary (AI-generated)           │   │
│  │ [Concise summary here...]        │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ 📋 Copy │ 🔗 Share │ 𝕏 │ 📘 │    │
│  └──────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  [AD BANNER - BOTTOM]                   │
└─────────────────────────────────────────┘
```

### Phase 2: Sharing System

#### 2.1 Share Options

1. **Copy to Clipboard** - Copy transcript/summary as text
2. **Share Link** - Generate URL like `speech-to-text.me/s/abc123`
3. **Twitter/X** - Share with pre-filled tweet
4. **Facebook** - Share to Facebook
5. **WhatsApp** - Share via WhatsApp
6. **Email** - Open email client with content

#### 2.2 Share Link Implementation

```typescript
// Generate short ID
import { nanoid } from 'nanoid';

async createShare(transcript: string, summary: string): Promise<string> {
  const id = nanoid(8); // e.g., "V1StGXR8"
  const content = {
    id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    transcript,
    summary,
  };

  // Save to data/shares/{id}.json
  await this.saveShare(content);

  return `https://speech-to-text.me/s/${id}`;
}
```

#### 2.3 Social Share URLs

```javascript
const shareUrls = {
  twitter: (text, url) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,

  facebook: (url) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,

  whatsapp: (text) =>
    `https://wa.me/?text=${encodeURIComponent(text)}`,

  email: (subject, body) =>
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
};
```

### Phase 3: Ads Integration

#### 3.1 Google AdSense Setup

1. Sign up at https://www.google.com/adsense
2. Add site and verify ownership
3. Get ad unit code

#### 3.2 Ad Component

```jsx
// components/AdBanner.js
import { useEffect } from 'react';

export function AdBanner({ slot, format = 'auto' }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('Ad error:', e);
    }
  }, []);

  return (
    <div className="ad-container">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
```

#### 3.3 Ad Placement Strategy

- **Top banner**: 728x90 leaderboard (desktop) / 320x50 (mobile)
- **Bottom banner**: Same as top
- **Optional**: Interstitial after 3 transcriptions

### Phase 4: Rate Limiting (Free Tier Limits)

```typescript
// Simple IP-based rate limiting
interface RateLimit {
  transcriptions: number;  // Max 10 per day
  summaries: number;       // Max 10 per day
}

// Store in memory or Redis
const rateLimits = new Map<string, RateLimit>();
```

---

## Environment Variables

```env
# OpenAI (Whisper)
OPENAI_API_KEY=sk-...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# App Config
NODE_ENV=production
CORS_ORIGIN=https://speech-to-text.me

# Rate Limits
MAX_DAILY_TRANSCRIPTIONS=10
MAX_DAILY_SUMMARIES=10

# Share Config
SHARE_EXPIRY_HOURS=24
```

---

## Deployment (Coolify)

1. Create new project in Coolify
2. Add repository
3. Configure domains:
   - Frontend: `speech-to-text.me`, `www.speech-to-text.me`
   - Backend: `api.speech-to-text.me`
4. Set environment variables
5. Deploy

---

## Future Enhancements

1. **User accounts** (optional, for history)
2. **Premium tier** (unlimited, no ads)
3. **API access** (developer tier)
4. **More languages** (auto-detect)
5. **Audio file upload** (not just recording)
6. **Video transcription** (YouTube links)
