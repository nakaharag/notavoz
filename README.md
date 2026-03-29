# NotaVoz

Voice-to-text clinical notes application designed for psychologists. Record patient sessions, get automatic transcription with AI-powered correction and summarization.

## Features

- **Voice Recording** - Record consultations directly in the browser
- **Portuguese Transcription** - Powered by OpenAI Whisper (95-97% accuracy)
- **AI Processing** - Automatic spelling correction and clinical summary generation (Claude AI)
- **Record Management** - Save, edit, and organize patient session notes
- **Text-to-Speech** - Listen back to notes (Browser Speech API - free)
- **Simple Authentication** - Fixed user/password login
- **Elderly-Friendly UI** - Large fonts, high contrast, minimal clicks

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 |
| Backend | NestJS (Node.js) |
| Speech-to-Text | OpenAI Whisper |
| AI Processing | Claude AI (Anthropic) |
| Text-to-Speech | Browser Speech API |
| Storage | JSON files |
| Package Manager | pnpm |
| Deployment | Docker + Nginx |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- pnpm (for local development): `npm install -g pnpm`
- API Keys:
  - [OpenAI API Key](https://platform.openai.com/api-keys) (transcription)
  - [Anthropic API Key](https://console.anthropic.com/) (AI processing)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/notavoz.git
cd notavoz
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your API keys:
```env
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
AUTH_USER=your-username
AUTH_PASSWORD=your-secure-password
```

4. Start the application:
```bash
docker compose up --build
```

5. Open http://localhost:3001

## Development with Hot Reload

For development, use the dev compose file which enables hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

**Features:**
- Source code (`src/`) mounted as volumes - changes reflect immediately
- Backend runs NestJS in watch mode
- Frontend runs React dev server with hot reload
- No rebuild needed for code changes (only for `package.json` changes)

**Ports:**
- Backend: http://localhost:3000
- Frontend: http://localhost:3001

## Usage

1. **Login** with the credentials set in `.env`
2. **New Consultation** tab:
   - Enter patient name (optional)
   - Click the green **Gravar** button to start recording
   - Click **Parar** when finished
   - Wait for transcription and AI processing
   - Review/edit the notes and summary
   - Click **Salvar Registro** to save
3. **Historico** tab:
   - View all saved records
   - Click a record to view/edit details
   - Delete records if needed

## Project Structure

```
notavoz/
├── frontend/          # React application
├── backend/           # NestJS API server
│   ├── src/
│   │   ├── auth/      # Authentication module
│   │   ├── controllers/
│   │   └── services/
│   └── data/          # Patient records (JSON)
├── nginx/             # Production proxy config
├── docker-compose.yml # Development setup
└── docker-compose.prod.yml # Production setup
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Authenticate user |
| POST | `/speech/transcribe` | Transcribe audio |
| POST | `/report/generate` | AI correction + summary |
| GET | `/records` | List all records |
| POST | `/records` | Create record |
| PUT | `/records/:id` | Update record |
| DELETE | `/records/:id` | Delete record |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_USER` | Login username |
| `AUTH_PASSWORD` | Login password |
| `JWT_SECRET` | Secret for JWT tokens |
| `OPENAI_API_KEY` | OpenAI API key (Whisper) |
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude) |

## License

MIT
