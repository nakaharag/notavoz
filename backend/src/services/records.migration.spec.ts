import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../db/database.service';
import { UsersService } from '../auth/users.service';
import { RecordsService } from './records.service';

describe('legacy JSON record migration', () => {
  const originalEnv = { ...process.env };
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'notavoz-migration-'));
    Object.assign(process.env, { NODE_ENV: 'production', DATA_DIR: directory, SEED_USERNAME: 'dona', SEED_PASSWORD: 'senha123' });
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    process.env = { ...originalEnv };
  });

  it('assigns existing records to the owner once, keeping the JSON backup', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    mkdirSync(join(directory, 'records'));
    writeFileSync(join(directory, 'records', 'index.json'), JSON.stringify([id]));
    writeFileSync(join(directory, 'records', `${id}.json`), JSON.stringify({
      id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', patientName: 'Pessoa Ficticia',
      rawTranscript: 'Texto sintetico.', correctedTranscript: '', summary: '', notes: 'nota',
    }));
    const database = new DatabaseService();
    const users = new UsersService(database);
    const records = new RecordsService(database, users);
    await records.onModuleInit();
    await records.onModuleInit();
    const owner = users.findByUsername('dona');
    expect(owner).not.toBeNull();
    const list = await records.findAll(owner!.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, patientName: 'Pessoa Ficticia', notes: 'nota', updatedAt: '2026-01-02T00:00:00.000Z' });
    expect(await records.findAll(owner!.id + 1)).toEqual([]);
    expect(existsSync(join(directory, 'records'))).toBe(false);
    expect(readdirSync(directory).some((name) => name.startsWith('records.migrated-'))).toBe(true);
    database.onModuleDestroy();
  });

  it('defers migration when the owner does not exist', async () => {
    delete process.env.SEED_USERNAME;
    delete process.env.SEED_PASSWORD;
    mkdirSync(join(directory, 'records'));
    writeFileSync(join(directory, 'records', 'index.json'), '[]');
    const database = new DatabaseService();
    const records = new RecordsService(database, new UsersService(database));
    await records.onModuleInit();
    expect(existsSync(join(directory, 'records', 'index.json'))).toBe(true);
    database.onModuleDestroy();
  });
});
