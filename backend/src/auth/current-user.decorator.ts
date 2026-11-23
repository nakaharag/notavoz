import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: number;
  username: string;
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthenticatedUser =>
  context.switchToHttp().getRequest().user);
