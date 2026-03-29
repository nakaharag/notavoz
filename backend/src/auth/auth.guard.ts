import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticacao ausente');
    }

    const token = authHeader.substring(7);
    const decoded = this.authService.verifyToken(token);

    if (!decoded) {
      throw new UnauthorizedException('Token invalido ou expirado');
    }

    request.user = decoded;
    return true;
  }
}
