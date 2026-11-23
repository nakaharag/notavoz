import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import Database = require('better-sqlite3');
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1))
) STRICT;
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  patient_name TEXT NOT NULL,
  raw_transcript TEXT NOT NULL,
  corrected_transcript TEXT NOT NULL,
  summary TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS records_user_created ON records(user_id, created_at);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
`;

export function dataDirectory(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

export function openDatabase(dataDir = dataDirectory()): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, 'notavoz.db');
  fs.closeSync(fs.openSync(file, 'a', 0o600));
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
  db.exec(SCHEMA);
  return db;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database.Database = openDatabase();

  onModuleDestroy(): void {
    if (this.db.open) this.db.close();
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
