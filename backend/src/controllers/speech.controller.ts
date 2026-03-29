import { Controller, Post, UploadedFile, Body, Res, UseGuards } from '@nestjs/common';
import { SpeechService } from '@services/speech.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';

@Controller('speech')
@UseGuards(AuthGuard)
export class SpeechController {
  constructor(private readonly speechService: SpeechService) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(@UploadedFile() file: Express.Multer.File) {
    const transcription = await this.speechService.transcribeAudio(file.buffer);
    return { transcription };
  }

  @Post('synthesize')
  async synthesize(@Body('text') text: string, @Res() res: Response) {
    const audioContent = await this.speechService.synthesizeSpeech(text);
    res.set({
      'Content-Type': 'audio/mp3',
      'Content-Length': audioContent.length,
    });
    res.send(audioContent);
  }
}
