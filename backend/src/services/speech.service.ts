import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { apiError, openaiRequest } from './openai-api';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;

@Injectable()
export class SpeechService {
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (!audioBuffer?.length || audioBuffer.length > MAX_AUDIO_BYTES) {
      throw apiError('INVALID_INPUT', 'Envie audio de ate 10 MiB e 5 minutos.', 400);
    }
    const wav = await this.convertAudio(audioBuffer);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-transcribe');
    form.append('response_format', 'json');
    const data = await openaiRequest('audio/transcriptions', form);
    if (typeof data.text !== 'string' || !data.text.trim()) {
      throw apiError('EMPTY_TRANSCRIPTION', 'Transcricao vazia. Verifique o audio e tente novamente.', 422, true);
    }
    return data.text.trim();
  }

  // Decode to bounded PCM: sample count checks real duration, including files with
  // absent/forged metadata. No input/output audio is written to disk.
  private convertAudio(input: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pcmLimit = MAX_AUDIO_SECONDS * 16000 * 2;
      const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin',
        '-protocol_whitelist', 'pipe', '-threads', '1', '-i', 'pipe:0',
        '-vn', '-ac', '1', '-ar', '16000', '-threads', '1', '-f', 's16le', 'pipe:1'],
      { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      let size = 0;
      let failure: Error;
      const timer = setTimeout(() => {
        failure = apiError('AUDIO_TIMEOUT', 'Conversao de audio excedeu 30 segundos.', 504, true);
        child.kill('SIGKILL');
      }, 30_000);
      child.stdin.on('error', () => { /* Exit status handles invalid input / EPIPE. */ });
      child.stdout.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > pcmLimit) {
          failure = apiError('INVALID_INPUT', 'Audio excede 5 minutos.', 400);
          child.kill('SIGKILL');
        } else chunks.push(chunk);
      });
      child.on('error', () => {
        failure = apiError('AUDIO_UNAVAILABLE', 'Conversor de audio indisponivel.');
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (failure) return reject(failure);
        if (code !== 0 || !size) return reject(apiError('INVALID_INPUT', 'Audio invalido ou formato nao suportado.', 400));
        const header = Buffer.alloc(44);
        header.write('RIFF'); header.writeUInt32LE(36 + size, 4); header.write('WAVEfmt ', 8);
        header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
        header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28);
        header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
        header.write('data', 36); header.writeUInt32LE(size, 40);
        resolve(Buffer.concat([header, ...chunks]));
      });
      child.stdin.end(input);
    });
  }
}
