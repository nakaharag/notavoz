import { BadRequestException, Controller, Post, UploadedFile, UseGuards } from '@nestjs/common';
import { SpeechService, MAX_AUDIO_BYTES } from '../services/speech.service';
import { WorkLimitGuard } from '../work-limit.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

@Controller('speech')
@UseGuards(AuthGuard, WorkLimitGuard)
export class SpeechController {
  constructor(private readonly speechService: SpeechService) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0, parts: 2 } }))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo de áudio.');
    }
    const transcription = await this.speechService.transcribeAudio(file.buffer);
    return { transcription };
  }
}
