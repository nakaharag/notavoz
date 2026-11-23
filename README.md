# NotaVoz

Voice-to-text clinical notes application designed for psychologists. Record patient sessions, get automatic transcription with AI-powered correction and summarization.

## Features

- **Voice Recording** - Record consultations directly in the browser
- **Portuguese Transcription** - Powered by OpenAI speech-to-text
- **AI Processing** - Automatic spelling correction and clinical summary generation (OpenAI)
- **Record Management** - Save, edit, and organize patient session notes
- **Text-to-Speech** - Listen back to notes (Browser Speech API - free)
- **Simple Authentication** - Fixed user/password login
- **Elderly-Friendly UI** - Large fonts, high contrast, minimal clicks

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 |
| Backend | NestJS (Node.js) |
| Speech-to-Text | OpenAI Transcriptions API |
| AI Processing | OpenAI Responses API |
| Text-to-Speech | Browser Speech API |
| Storage | JSON files |
| Package Manager | pnpm |
| Deployment | Docker Compose + Caddy |

## Deploy no Lightsail

Piloto exclusivamente com dados fictícios: [handoff, limites, testes e rollback](docs/PILOT-HANDOFF.md). Use somente `docker-compose.prod.yml` para este piloto; o Compose raiz é legado (Coolify).

1. Instale Docker Engine e o plugin Docker Compose na VM Ubuntu. No firewall do Lightsail, libere TCP 80 e 443 e restrinja SSH ao seu IP.
2. Copie o projeto para a VM, entre na pasta do projeto e configure o ambiente.

```sh
umask 077
cp -n .env.example .env
nano .env
```

Defina `JWT_SECRET` (ao menos 32 caracteres), `OPENAI_API_KEY`, `SEED_USERNAME` e `SEED_PASSWORD` (primeiro usuário, 8+ caracteres). Para gerar um segredo, use `openssl rand -hex 32`. Preencha `NOTAVOZ_DOMAIN` com o domínio do piloto; o exemplo não é domínio de publicação. Outras contas: veja "Contas de usuário" em `docs/PILOT-HANDOFF.md`.

3. Compile as imagens na VM, em sequência. Esse passo pode ser feito antes de apontar o DNS.

```sh
sudo bash deploy.sh --prepare
```

4. Na Cloudflare, use DNS only na emissão inicial. Aponte o registro A do domínio escolhido para `<IP_ESTATICO>` e faça o domínio de redirecionamento apontar para ele via CNAME. Verifique os registros AAAA dos dois hosts se a VM for publicada só em IPv4.
5. Inicie os serviços. O Caddy tenta emitir os certificados quando o domínio já aponta para a VM.

```sh
sudo bash deploy.sh --start
curl -fsSI https://<DOMINIO_DO_PILOTO>/
curl -s -o /dev/null -w '%{http_code}\n' https://<DOMINIO_DO_PILOTO>/api/records
```

A última chamada deve retornar HTTP 401 sem autenticação. Teste o login e uma transcrição fictícia no navegador. O volume `notavoz_data` guarda os registros. O volume `caddy_data` guarda os certificados.

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
│   │   ├── entities/  # TypeORM entities
│   │   └── services/
├── Caddyfile          # Proxy HTTPS de produção
├── docker-compose.prod.yml # Produção no Lightsail
└── docker-compose.dev.yml # Development setup (hot reload)
```

## API Endpoints

Em produção, todos os caminhos abaixo recebem o prefixo `/api`; desenvolvimento mantém os caminhos originais.

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
| `SEED_USERNAME` | Initial user created in the database if missing |
| `SEED_PASSWORD` | Password for that user (8+ characters) |
| `JWT_SECRET` | Secret for JWT tokens |
| `OPENAI_API_KEY` | Chave OpenAI para transcrição e texto |
| `OPENAI_TRANSCRIPTION_MODEL` | Modelo de transcrição, padrão `gpt-transcribe` |
| `OPENAI_TEXT_MODEL` | Modelo de texto, padrão `gpt-5.4-mini` |
| `NOTAVOZ_DOMAIN`, `NOTAVOZ_WWW_DOMAIN` | Domínios usados pelo Caddy |

## License

MIT
