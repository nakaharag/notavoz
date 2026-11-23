import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID as uuidv4 } from 'crypto';
import { DatabaseService, dataDirectory } from '../db/database.service';
import { UsersService } from '../auth/users.service';

export interface PatientRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  patientName: string;
  rawTranscript: string;
  correctedTranscript: string;
  summary: string;
  notes: string;
}

export interface CreateRecordInput {
  patientName?: string;
  rawTranscript?: string;
  correctedTranscript?: string;
  summary?: string;
  notes?: string;
}

type UpdatableField = 'patientName' | 'correctedTranscript' | 'summary' | 'notes';

const UPDATABLE: Record<UpdatableField, string> = {
  patientName: 'patient_name',
  correctedTranscript: 'corrected_transcript',
  summary: 'summary',
  notes: 'notes',
};

const COLUMNS = `id, created_at AS createdAt, updated_at AS updatedAt, patient_name AS patientName,
  raw_transcript AS rawTranscript, corrected_transcript AS correctedTranscript, summary, notes`;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RecordsService implements OnModuleInit {
  private readonly logger = new Logger(RecordsService.name);

  constructor(private readonly database: DatabaseService, private readonly users: UsersService) {}

  private get db() {
    return this.database.db;
  }

  async onModuleInit(): Promise<void> {
    await this.users.seedFromEnvironment();
    this.migrateLegacyJson();
  }

  private migrateLegacyJson(): void {
    const recordsDir = path.join(dataDirectory(), 'records');
    if (!fs.existsSync(path.join(recordsDir, 'index.json'))) return;
    const ownerName = process.env.LEGACY_OWNER || process.env.SEED_USERNAME || (process.env.NODE_ENV === 'production' ? '' : 'admin');
    const owner = ownerName ? this.users.findByUsername(ownerName) : null;
    if (!owner) {
      this.logger.warn('Registros JSON antigos encontrados, mas o dono (LEGACY_OWNER) nao existe. Migracao adiada.');
      return;
    }
    const ids: string[] = JSON.parse(fs.readFileSync(path.join(recordsDir, 'index.json'), 'utf-8'));
    const insert = this.db.prepare(`INSERT OR IGNORE INTO records
      (id, user_id, patient_name, raw_transcript, corrected_transcript, summary, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    let migrated = 0;
    this.db.transaction(() => {
      for (const id of ids) {
        if (!UUID_V4.test(id)) continue;
        const file = path.join(recordsDir, `${id}.json`);
        if (!fs.existsSync(file)) continue;
        const r = JSON.parse(fs.readFileSync(file, 'utf-8'));
        migrated += insert.run(id, owner.id, r.patientName ?? '', r.rawTranscript ?? '', r.correctedTranscript ?? '',
          r.summary ?? '', r.notes ?? '', r.createdAt, r.updatedAt ?? r.createdAt).changes;
      }
    })();
    fs.renameSync(recordsDir, `${recordsDir}.migrated-${new Date().toISOString().slice(0, 10)}`);
    this.logger.log(`Registros JSON migrados para ${owner.username}: ${migrated}`);
  }

  private assertUuid(id: string): void {
    if (!UUID_V4.test(id)) throw new BadRequestException('ID UUID invalido');
  }

  async findAll(userId: number): Promise<PatientRecord[]> {
    return this.db.prepare(`SELECT ${COLUMNS} FROM records WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as PatientRecord[];
  }

  async findById(userId: number, id: string): Promise<PatientRecord | null> {
    this.assertUuid(id);
    return (this.db.prepare(`SELECT ${COLUMNS} FROM records WHERE id = ? AND user_id = ?`).get(id, userId) as PatientRecord | undefined) ?? null;
  }

  async create(userId: number, data: CreateRecordInput): Promise<PatientRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO records
      (id, user_id, patient_name, raw_transcript, corrected_transcript, summary, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, userId, data.patientName || '', data.rawTranscript || '',
      data.correctedTranscript || '', data.summary || '', data.notes || '', now, now);
    return (await this.findById(userId, id)) as PatientRecord;
  }

  async update(userId: number, id: string, data: Partial<Record<UpdatableField, string>>): Promise<PatientRecord | null> {
    const existing = await this.findById(userId, id);
    if (!existing) return null;
    const fields = (Object.keys(UPDATABLE) as UpdatableField[]).filter((key) => typeof data[key] === 'string');
    const sets = [...fields.map((key) => `${UPDATABLE[key]} = ?`), 'updated_at = ?'];
    const values = [...fields.map((key) => data[key] as string), new Date().toISOString()];
    this.db.prepare(`UPDATE records SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values, id, userId);
    return this.findById(userId, id);
  }

  async delete(userId: number, id: string): Promise<boolean> {
    this.assertUuid(id);
    return this.db.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').run(id, userId).changes === 1;
  }
}
