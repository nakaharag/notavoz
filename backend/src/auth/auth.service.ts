import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User, UsersService } from './users.service';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(private readonly users: UsersService) {
    const production = process.env.NODE_ENV === 'production';
    this.jwtSecret = process.env.JWT_SECRET || (production ? '' : 'notavoz-local-development-only');
    if (production && (this.jwtSecret.length < 32 ||
      /change|your-|placeholder|dev-secret|notavoz-secret/i.test(this.jwtSecret))) {
      throw new Error('Configure JWT_SECRET aleatorio (32+ caracteres).');
    }
  }

  async login(username: string, password: string): Promise<{ token: string }> {
    const user = await this.users.authenticate(username, password);
    if (!user) throw new UnauthorizedException('Usuario ou senha incorretos');
    return { token: jwt.sign({}, this.jwtSecret, {
      algorithm: 'HS256', subject: String(user.id), issuer: 'notavoz',
      audience: 'notavoz-web', expiresIn: '1h',
    }) };
  }

  verifyToken(token: string): User | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'], issuer: 'notavoz', audience: 'notavoz-web', maxAge: '1h',
      });
      if (typeof decoded === 'string' || !Number.isFinite(decoded.exp) || !Number.isFinite(decoded.iat)) return null;
      const id = Number(decoded.sub);
      if (!Number.isInteger(id)) return null;
      const user = this.users.findById(id);
      return user && !user.disabled ? user : null;
    } catch {
      return null;
    }
  }
}
