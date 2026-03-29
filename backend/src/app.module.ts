import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SpeechService } from '@services/speech.service';
import { ClaudeService } from '@services/claude.service';
import { RecordsService } from '@services/records.service';
import { SpeechController } from '@controllers/speech.controller';
import { ReportController } from '@controllers/report.controller';
import { RecordsController } from '@controllers/records.controller';

@Module({
  imports: [AuthModule],
  controllers: [SpeechController, ReportController, RecordsController],
  providers: [SpeechService, ClaudeService, RecordsService],
})
export class AppModule {}
