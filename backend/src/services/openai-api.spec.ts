import { openaiRequest } from './openai-api';
import { ReportService } from './report.service';

describe('OpenAI failure bounds', () => {
  beforeEach(() => { process.env.OPENAI_API_KEY = 'synthetic'; });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('aborts a hanging provider after 90 seconds', async () => {
    jest.useFakeTimers();
    const mock = jest.spyOn(global, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = openaiRequest('responses', '{}', true);
    const assertion = expect(pending).rejects.toMatchObject({ response: { code: 'PROVIDER_TIMEOUT' } });
    await jest.advanceTimersByTimeAsync(90000);
    await assertion;
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{cut' }] }] },
    { status: 'completed', output: [{ type: 'function_call' }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
  ])('never accepts partial, malformed, tool or refusal output', async (response) => {
    const mock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(response)));
    await expect(new ReportService().processTranscript('Dado ficticio')).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
