import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

@Injectable()
export class RecordsService {
  private readonly dataDir: string;
  private readonly recordsDir: string;
  private readonly indexFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.recordsDir = path.join(this.dataDir, 'records');
    this.indexFile = path.join(this.recordsDir, 'index.json');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.recordsDir)) {
      fs.mkdirSync(this.recordsDir, { recursive: true });
    }
    if (!fs.existsSync(this.indexFile)) {
      fs.writeFileSync(this.indexFile, JSON.stringify([], null, 2));
    }
  }

  private getIndex(): string[] {
    try {
      const content = fs.readFileSync(this.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private saveIndex(index: string[]): void {
    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
  }

  private getRecordPath(id: string): string {
    return path.join(this.recordsDir, `${id}.json`);
  }

  async findAll(): Promise<PatientRecord[]> {
    const index = this.getIndex();
    const records: PatientRecord[] = [];

    for (const id of index) {
      const record = await this.findById(id);
      if (record) {
        records.push(record);
      }
    }

    return records.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findById(id: string): Promise<PatientRecord | null> {
    const recordPath = this.getRecordPath(id);

    if (!fs.existsSync(recordPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(recordPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async create(data: CreateRecordInput): Promise<PatientRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: PatientRecord = {
      id,
      createdAt: now,
      updatedAt: now,
      patientName: data.patientName || '',
      rawTranscript: data.rawTranscript || '',
      correctedTranscript: data.correctedTranscript || '',
      summary: data.summary || '',
      notes: data.notes || '',
    };

    const recordPath = this.getRecordPath(id);
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

    const index = this.getIndex();
    index.push(id);
    this.saveIndex(index);

    return record;
  }

  async update(id: string, data: Partial<PatientRecord>): Promise<PatientRecord | null> {
    const existing = await this.findById(id);

    if (!existing) {
      return null;
    }

    const updated: PatientRecord = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const recordPath = this.getRecordPath(id);
    fs.writeFileSync(recordPath, JSON.stringify(updated, null, 2));

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const recordPath = this.getRecordPath(id);

    if (!fs.existsSync(recordPath)) {
      return false;
    }

    fs.unlinkSync(recordPath);

    const index = this.getIndex();
    const newIndex = index.filter((recordId) => recordId !== id);
    this.saveIndex(newIndex);

    return true;
  }
}
