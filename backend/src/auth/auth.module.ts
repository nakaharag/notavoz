import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginLimitGuard } from './login-limit.guard';
import { AuthGuard } from './auth.guard';
import { UsersService } from './users.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, LoginLimitGuard, UsersService],
  exports: [AuthService, AuthGuard, UsersService],
})
export class AuthModule {}
