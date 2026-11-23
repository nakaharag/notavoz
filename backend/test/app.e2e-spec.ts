import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { mkdtempSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/auth/users.service';

function syntheticWav(seconds = 1): Buffer {
  const size = seconds * 16000 * 2;
  const wav = Buffer.alloc(44 + size);
  wav.write('RIFF'); wav.writeUInt32LE(36 + size, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(size, 40);
  return wav;
}

const completed = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text',
  text: JSON.stringify({ correctedTranscript: 'Texto sintetico corrigido.', summary: '- Exemplo ficticio.' }),
}] }] };

describe('Piloto sintetico: API real, ffmpeg real, OpenAI mock', () => {
  let app: INestApplication;
  let token: string;
  let directory: string;
  let provider: jest.SpyInstance;
  const originalEnv = { ...process.env };
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const boot = async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false, logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  };
  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'notavoz-synthetic-'));
    Object.assign(process.env, {
      NODE_ENV: 'production', API_PREFIX: 'api', DATA_DIR: directory,
      SEED_USERNAME: 'synthetic', SEED_PASSWORD: 'sintetic',
      JWT_SECRET: 'synthetic-jwt-secret-with-at-least-32-characters', OPENAI_API_KEY: 'synthetic',
    });
    await boot();
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ username: 'synthetic', password: 'sintetic' }).expect(200);
    token = login.body.token;
  });
  beforeEach(() => { provider = jest.spyOn(global, 'fetch'); });
  afterEach(() => provider?.mockRestore());
  afterAll(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it('health prefix and authorization for all protected endpoints', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/health').expect(404);
    for (const [method, route] of [['get', '/records'], ['post', '/records'],
      ['put', '/records/not-a-uuid'], ['delete', '/records/not-a-uuid'],
      ['post', '/speech/transcribe'], ['post', '/report/generate']]) {
      await request(app.getHttpServer())[method](`/api${route}`).expect(401);
    }
    await request(app.getHttpServer()).get('/api/records').set('Authorization', `Bearer ${token}x`).expect(401);
  });

  it('rejects expired, missing-exp, wrong audience/issuer/subject and wrong algorithm JWTs', async () => {
    const service = app.get(AuthService);
    for (const options of [
      { expiresIn: -1 }, { audience: 'other' }, { issuer: 'other' }, { subject: 'other' }, { subject: '999' }, { algorithm: 'HS384' },
    ]) {
      const invalid = jwt.sign({}, process.env.JWT_SECRET, {
        expiresIn: '1h', issuer: 'notavoz', audience: 'notavoz-web', subject: '1', ...options,
      } as jwt.SignOptions);
      expect(service.verifyToken(invalid)).toBeNull();
    }
    expect(service.verifyToken(jwt.sign({}, process.env.JWT_SECRET, {
      issuer: 'notavoz', audience: 'notavoz-web', subject: '1',
    }))).toBeNull();
    expect(service.verifyToken(token)?.username).toBe('synthetic');
  });

  it('fails closed without production credentials', () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => new AuthService(app.get(UsersService))).toThrow();
    process.env.JWT_SECRET = secret;
  });

  it('rejects invalid UUID and text input', async () => {
    for (const method of ['get', 'put', 'delete']) {
      await request(app.getHttpServer())[method]('/api/records/not-a-uuid').set(auth()).expect(400);
    }
    for (const text of ['', '  ', 'x'.repeat(30001)]) {
      await request(app.getHttpServer()).post('/api/report/generate').set(auth()).send({ text }).expect(400);
    }
    expect(provider).not.toHaveBeenCalled();
  });

  it('transcribes synthetic audio through ffmpeg and the official endpoint', async () => {
    provider.mockResolvedValue(new Response(JSON.stringify({ text: 'Transcricao ficticia.' }), { status: 200 }));
    const response = await request(app.getHttpServer()).post('/api/speech/transcribe').set(auth())
      .attach('audio', syntheticWav(), 'synthetic.wav').expect(201);
    expect(response.body.transcription).toBe('Transcricao ficticia.');
    expect(provider.mock.calls[0][0]).toBe('https://api.openai.com/v1/audio/transcriptions');
    const form = provider.mock.calls[0][1].body as FormData;
    expect(form.get('model')).toBe('gpt-transcribe');
    expect((form.get('file') as Blob).size).toBeGreaterThan(44);
  });

  it('rejects missing, invalid, oversized and over-duration audio before OpenAI', async () => {
    await request(app.getHttpServer()).post('/api/speech/transcribe').set(auth()).expect(400);
    await request(app.getHttpServer()).post('/api/speech/transcribe').set(auth())
      .attach('audio', Buffer.from('invalid synthetic audio'), 'bad.wav').expect(400);
    await request(app.getHttpServer()).post('/api/speech/transcribe').set(auth())
      .attach('audio', Buffer.alloc(10 * 1024 * 1024 + 1), 'large.wav').expect(413);
    await request(app.getHttpServer()).post('/api/speech/transcribe').set(auth())
      .attach('audio', syntheticWav(301), 'long.wav').expect(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it('generates the existing response contract without tools or storage', async () => {
    provider.mockResolvedValue(new Response(JSON.stringify(completed)));
    const result = await request(app.getHttpServer()).post('/api/report/generate').set(auth())
      .send({ text: 'Texto apenas sintetico.' }).expect(201);
    expect(result.body).toEqual({ correctedTranscript: 'Texto sintetico corrigido.', summary: '- Exemplo ficticio.' });
    expect(provider.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(provider.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'gpt-5.4-mini', store: false, tools: [], tool_choice: 'none' });
  });

  it.each([
    [401, 'invalid_api_key', 502, 'PROVIDER_CREDENTIAL'],
    [429, 'rate_limit_exceeded', 429, 'PROVIDER_RATE_LIMIT'],
    [429, 'insufficient_quota', 502, 'PROVIDER_QUOTA'],
    [404, 'model_not_found', 502, 'PROVIDER_MODEL'],
    [400, 'invalid_request', 400, 'INVALID_INPUT'],
    [504, 'timeout', 504, 'PROVIDER_TIMEOUT'],
  ])('maps provider %s/%s safely', async (upstream, code, status, expected) => {
    provider.mockResolvedValue(new Response(JSON.stringify({ error: { code, message: 'DO NOT LEAK CONTENT' } }), { status: upstream as number }));
    const response = await request(app.getHttpServer()).post('/api/report/generate').set(auth())
      .send({ text: 'Transcricao ficticia preservada.' }).expect(status as number);
    expect(response.body.code).toBe(expected);
    expect(JSON.stringify(response.body)).not.toContain('DO NOT LEAK');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('rejects concurrent expensive work before buffering another upload', async () => {
    let finish: (response: Response) => void;
    let started: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    provider.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; started(); }));
    const pending = request(app.getHttpServer()).post('/api/report/generate').set(auth())
      .send({ text: 'Dado ficticio.' }).then(result => result);
    await entered;
    const blocked = await request(app.getHttpServer()).post('/api/speech/transcribe').set(auth())
      .attach('audio', syntheticWav(), 'synthetic.wav').expect(429);
    expect(blocked.body.code).toBe('BUSY');
    finish(new Response(JSON.stringify(completed)));
    expect((await pending).status).toBe(201);
  });

  it('keeps saved raw transcript across model error, app restart, retry and CRUD', async () => {
    const created = await request(app.getHttpServer()).post('/api/records').set(auth())
      .send({ patientName: 'Pessoa Ficticia', rawTranscript: 'Somente dados sinteticos.' }).expect(201);
    const id = created.body.id;
    expect(statSync(join(directory, 'notavoz.db')).mode & 0o777).toBe(0o600);
    provider.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })));
    await request(app.getHttpServer()).post('/api/report/generate').set(auth())
      .send({ text: created.body.rawTranscript }).expect(502);
    await app.close();
    await boot();
    const persisted = await request(app.getHttpServer()).get(`/api/records/${id}`).set(auth()).expect(200);
    expect(persisted.body.rawTranscript).toBe('Somente dados sinteticos.');
    provider.mockResolvedValueOnce(new Response(JSON.stringify(completed)));
    await request(app.getHttpServer()).post('/api/report/generate').set(auth())
      .send({ text: persisted.body.rawTranscript }).expect(201);
    await request(app.getHttpServer()).put(`/api/records/${id}`).set(auth()).send({ notes: 'Nota ficticia editada' }).expect(200);
    const list = await request(app.getHttpServer()).get('/api/records').set(auth()).expect(200);
    expect(list.body[0].notes).toBe('Nota ficticia editada');
    await request(app.getHttpServer()).delete(`/api/records/${id}`).set(auth()).expect(200);
    await request(app.getHttpServer()).get(`/api/records/${id}`).set(auth()).expect(404);
  });

  it('limits login attempts even with forged forwarded IPs', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', `192.0.2.${i}`)
        .send({ username: 'bad', password: 'bad' }).expect(401);
    }
    const blocked = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ username: 'bad', password: 'bad' }).expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    await request(app.getHttpServer()).post('/api/auth/login')
      .send({ username: 'synthetic', password: 'sintetic' }).expect(200);
  });

  it('accepts 8-char DB passwords, rejects shorter ones, and honours disabled users', async () => {
    const users = app.get(UsersService);
    await expect(users.create('curta', 'abc1234')).rejects.toThrow();
    await users.create('segunda', 'segunda1');
    await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'SEGUNDA', password: 'segunda1' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'segunda', password: 'errada12' }).expect(401);
    users.setDisabled('segunda', true);
    await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'segunda', password: 'segunda1' }).expect(401);
  });

  it('isolates records between users', async () => {
    await app.get(UsersService).create('terceira', 'terceira1');
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ username: 'terceira', password: 'terceira1' }).expect(200);
    const other = { Authorization: `Bearer ${login.body.token}` };
    const mine = await request(app.getHttpServer()).post('/api/records').set(auth())
      .send({ patientName: 'Pessoa A', rawTranscript: 'Dado sintetico A.' }).expect(201);
    const id = mine.body.id;
    await request(app.getHttpServer()).get(`/api/records/${id}`).set(other).expect(404);
    await request(app.getHttpServer()).put(`/api/records/${id}`).set(other).send({ notes: 'invasao' }).expect(404);
    await request(app.getHttpServer()).delete(`/api/records/${id}`).set(other).expect(404);
    const list = await request(app.getHttpServer()).get('/api/records').set(other).expect(200);
    expect(list.body).toEqual([]);
    const intact = await request(app.getHttpServer()).get(`/api/records/${id}`).set(auth()).expect(200);
    expect(intact.body.notes).toBe('');
  });
});
