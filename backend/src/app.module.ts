import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { WorkLimitGuard } from './work-limit.guard';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './db/database.service';
import { SpeechService } from './services/speech.service';
import { ReportService } from './services/report.service';
import { RecordsService } from './services/records.service';
import { SpeechController } from './controllers/speech.controller';
import { ReportController } from './controllers/report.controller';
import { RecordsController } from './controllers/records.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, SpeechController, ReportController, RecordsController],
  providers: [WorkLimitGuard, SpeechService, ReportService, RecordsService],
})
export class AppModule {}
