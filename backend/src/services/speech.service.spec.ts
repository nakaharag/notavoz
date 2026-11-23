import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { SpeechService } from './speech.service';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

it('kills a stalled ffmpeg process after 30s without sending audio to OpenAI', async () => {
  jest.useFakeTimers();
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), kill: jest.fn(),
  });
  child.kill.mockImplementation(() => { child.emit('close', null); return true; });
  (spawn as jest.Mock).mockReturnValue(child);
  const fetchMock = jest.spyOn(global, 'fetch');
  try {
    const pending = new SpeechService().transcribeAudio(Buffer.from('synthetic'));
    const assertion = expect(pending).rejects.toMatchObject({ response: { code: 'AUDIO_TIMEOUT' } });
    await jest.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    fetchMock.mockRestore();
    jest.useRealTimers();
  }
});
