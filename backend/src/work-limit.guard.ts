import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { apiError } from './services/openai-api';

// Reject before Multer allocates buffers. No unbounded queue on a 2 GB host.
@Injectable()
export class WorkLimitGuard implements CanActivate {
  private active = 0;
  canActivate(context: ExecutionContext): boolean {
    if (this.active >= 1) throw apiError('BUSY', 'Outra operacao esta em andamento. Tente novamente.', 429, true);
    this.active++;
    const response = context.switchToHttp().getResponse();
    // finish follows completion of the handler, including a disconnected caller.
    let released = false;
    const release = () => { if (!released) { released = true; this.active--; } };
    response.once('finish', release);
    // A disconnected request can leave work running for up to 120s. Retain the
    // slot for that bound so reconnects cannot fan out conversions/API calls.
    response.once('close', () => { if (!released) setTimeout(release, 125_000).unref(); });
    return true;
  }
}
