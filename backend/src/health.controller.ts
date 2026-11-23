import { Controller, Get } from '@nestjs/common';
import { accessSync, constants } from 'fs';
import { join } from 'path';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    accessSync(process.env.DATA_DIR || join(process.cwd(), 'data'), constants.R_OK | constants.W_OK);
    return { status: 'ok' };
  }
}
