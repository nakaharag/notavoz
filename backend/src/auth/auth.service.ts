import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly username: string;
  private readonly password: string;
  private readonly jwtSecret: string;

  constructor() {
    this.username = process.env.AUTH_USER || 'admin';
    this.password = process.env.AUTH_PASSWORD || 'admin123';
    this.jwtSecret = process.env.JWT_SECRET || 'notavoz-secret-key-change-in-production';
  }

  async validateUser(username: string, password: string): Promise<boolean> {
    return username === this.username && password === this.password;
  }

  async login(username: string, password: string): Promise<{ token: string }> {
    const isValid = await this.validateUser(username, password);

    if (!isValid) {
      throw new UnauthorizedException('Usuario ou senha incorretos');
    }

    const token = this.generateToken(username);
    return { token };
  }

  private generateToken(username: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

    const payload = Buffer.from(JSON.stringify({
      sub: username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    })).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  verifyToken(token: string): { sub: string; iat: number; exp: number } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, payload, signature] = parts;

      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${header}.${payload}`)
        .digest('base64url');

      if (signature !== expectedSignature) return null;

      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

      if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

      return decoded;
    } catch {
      return null;
    }
  }
}
