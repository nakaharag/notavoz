import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class SpeechService {
  private openaiApiKey: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const audioStream = new Readable();
    audioStream.push(audioBuffer);
    audioStream.push(null);

    let convertedAudioBuffer: Buffer;
    try {
      convertedAudioBuffer = await this.convertAudioToMp3(audioStream);
    } catch (err) {
      console.error('FFmpeg conversion error:', err);
      throw new Error('Erro ao converter audio: ' + (err as Error).message);
    }

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `audio-${Date.now()}.mp3`);

    try {
      fs.writeFileSync(tempFile, convertedAudioBuffer);
      console.log(`Audio file saved: ${tempFile}, size: ${convertedAudioBuffer.length} bytes`);

      // Use native fetch with FormData
      const formData = new FormData();
      const fileBlob = new Blob([new Uint8Array(convertedAudioBuffer)], { type: 'audio/mpeg' });
      formData.append('file', fileBlob, 'audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        if (response.status === 401) {
          throw new Error('Chave da API OpenAI invalida.');
        }
        if (response.status === 429) {
          throw new Error('Creditos OpenAI esgotados. Adicione creditos em platform.openai.com');
        }
        throw new Error(`Erro OpenAI: ${response.status}`);
      }

      const data = await response.json();
      const transcription = data.text;

      if (!transcription || transcription.trim().length === 0) {
        throw new Error('Transcricao vazia. Tente falar mais alto ou mais perto do microfone.');
      }

      console.log('Transcription successful:', transcription.substring(0, 100) + '...');
      return transcription.trim();

    } catch (err) {
      console.error('Transcription error:', err);
      const error = err as Error & { cause?: Error };
      if (error.cause?.message?.includes('ECONNRESET') || error.message?.includes('fetch')) {
        throw new Error('Erro de conexao com OpenAI. Tente novamente.');
      }
      throw error;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private convertAudioToMp3(audioStream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const command = ffmpeg(audioStream)
        .format('mp3')
        .audioChannels(1)
        .audioFrequency(16000)
        .audioBitrate('64k')
        .on('error', (err) => reject(err));

      const ffmpegStream = command.pipe();

      ffmpegStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      ffmpegStream.on('end', () => resolve(Buffer.concat(chunks)));
      ffmpegStream.on('error', (err) => reject(err));
    });
  }
}
