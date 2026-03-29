import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ClaudeService } from '@services/claude.service';
import { AuthGuard } from '../auth/auth.guard';

class GenerateReportDto {
  text: string;
}

@Controller('report')
@UseGuards(AuthGuard)
export class ReportController {
  constructor(private readonly claudeService: ClaudeService) {}

  @Post('generate')
  async generateReport(@Body() dto: GenerateReportDto) {
    if (!dto.text || dto.text.trim().length === 0) {
      return {
        correctedTranscript: '',
        summary: '',
      };
    }

    const result = await this.claudeService.processTranscript(dto.text);

    return {
      correctedTranscript: result.correctedTranscript,
      summary: result.summary,
    };
  }
}
