import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const PER_USER = 5;
const GLOBAL = 60;

interface Window { attempts: number; resetAt: number }

// Per username, plus a global cap that also stops username spraying from rotating IPs.
@Injectable()
export class LoginLimitGuard implements CanActivate {
  private readonly users = new Map<string, Window>();
  private readonly global: Window = { attempts: 0, resetAt: 0 };

  private hit(window: Window, now: number): number {
    if (now >= window.resetAt) {
      window.attempts = 0;
      window.resetAt = now + WINDOW_MS;
    }
    window.attempts += 1;
    return window.attempts;
  }

  canActivate(context: ExecutionContext): boolean {
    const now = Date.now();
    const request = context.switchToHttp().getRequest();
    const name = typeof request.body?.username === 'string' ? request.body.username.trim().toLowerCase().slice(0, 64) : '';
    for (const [key, window] of this.users) if (now >= window.resetAt) this.users.delete(key);
    let window = this.users.get(name);
    if (!window) {
      window = { attempts: 0, resetAt: 0 };
      this.users.set(name, window);
    }
    const userAttempts = this.hit(window, now);
    const globalAttempts = this.hit(this.global, now);
    if (userAttempts > PER_USER || globalAttempts > GLOBAL) {
      const resetAt = userAttempts > PER_USER ? window.resetAt : this.global.resetAt;
      context.switchToHttp().getResponse().setHeader('Retry-After', Math.ceil((resetAt - now) / 1000));
      throw new HttpException({ code: 'LOGIN_RATE_LIMIT', message: 'Muitas tentativas. Aguarde um minuto.', retryable: true }, 429);
    }
    return true;
  }
}
