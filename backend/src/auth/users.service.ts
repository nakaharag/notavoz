import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { hashPassword, verifyPassword, verifyAgainstDummy } from './password';

export const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

export interface User {
  id: number;
  username: string;
  disabled: boolean;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  disabled: number;
}

const toUser = (row: UserRow): User => ({ id: row.id, username: row.username, disabled: row.disabled === 1 });

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly database: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.seedFromEnvironment();
  }

  private get db() {
    return this.database.db;
  }

  async create(username: string, password: string): Promise<User> {
    if (!USERNAME_PATTERN.test(username)) {
      throw new Error('Usuario deve ter 3 a 64 caracteres (letras, numeros, ponto, hifen, sublinhado).');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    const hash = await hashPassword(password);
    const info = this.db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .run(username, hash, new Date().toISOString());
    return { id: Number(info.lastInsertRowid), username, disabled: false };
  }

  async setPassword(username: string, password: string): Promise<boolean> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    const hash = await hashPassword(password);
    return this.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username).changes === 1;
  }

  setDisabled(username: string, disabled: boolean): boolean {
    return this.db.prepare('UPDATE users SET disabled = ? WHERE username = ?').run(disabled ? 1 : 0, username).changes === 1;
  }

  list(): User[] {
    return (this.db.prepare('SELECT id, username, password_hash, disabled FROM users ORDER BY id').all() as UserRow[]).map(toUser);
  }

  findById(id: number): User | null {
    const row = this.db.prepare('SELECT id, username, password_hash, disabled FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  findByUsername(username: string): User | null {
    const row = this.db.prepare('SELECT id, username, password_hash, disabled FROM users WHERE username = ?').get(username) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  async authenticate(username: string, password: string): Promise<User | null> {
    const row = this.db.prepare('SELECT id, username, password_hash, disabled FROM users WHERE username = ?').get(username) as UserRow | undefined;
    if (!row) {
      await verifyAgainstDummy(password);
      return null;
    }
    const valid = await verifyPassword(password, row.password_hash);
    return valid && row.disabled === 0 ? toUser(row) : null;
  }

  async seedFromEnvironment(): Promise<void> {
    const production = process.env.NODE_ENV === 'production';
    const username = process.env.SEED_USERNAME || (production ? '' : 'admin');
    const password = process.env.SEED_PASSWORD || (production ? '' : 'admin123');
    if (!username || !password || this.findByUsername(username)) return;
    await this.create(username, password);
    this.logger.log(`Usuario inicial criado: ${username}`);
  }
}
