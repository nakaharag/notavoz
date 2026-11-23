import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { WorkLimitGuard } from '../work-limit.guard';
import { AuthGuard } from '../auth/auth.guard';
import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

class GenerateReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30000)
  @Matches(/\S/)
  text: string;
}

@Controller('report')
@UseGuards(AuthGuard, WorkLimitGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  async generateReport(@Body() dto: GenerateReportDto) {
    const result = await this.reportService.processTranscript(dto.text);

    return {
      correctedTranscript: result.correctedTranscript,
      summary: result.summary,
    };
  }
}
