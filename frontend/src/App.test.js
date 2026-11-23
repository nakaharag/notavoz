import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

test('shows login and reports throttling', async () => {
  fetch.mockResolvedValue(response({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429));
  const { container } = render(<App />);
  fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'synthetic' } });
  fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 'synthetic' } });
  fireEvent.click(screen.getByText('Entrar'));
  expect(await screen.findByText('Muitas tentativas. Aguarde um minuto.')).toBeInTheDocument();
});

test('keeps raw transcript visible and retries generation without retranscribing', async () => {
  localStorage.setItem('authToken', 'synthetic-token');
  const stopTrack = jest.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
  } });
  window.AudioContext = class {
    createAnalyser() { return { frequencyBinCount: 1, getByteFrequencyData: () => {} }; }
    createMediaStreamSource() { return { connect: () => {} }; }
  };
  global.MediaRecorder = class {
    state = 'inactive';
    mimeType = 'audio/webm';
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable({ data: new Blob(['synthetic audio']) });
      this.onstop();
    }
  };
  fetch.mockResolvedValueOnce(response({ transcription: 'Transcricao inteiramente ficticia.' }))
    .mockResolvedValueOnce(response({ code: 'GENERATION_INCOMPLETE', message: 'Geracao incompleta. Tente novamente.' }, 502))
    .mockResolvedValueOnce(response({ correctedTranscript: 'Texto ficticio corrigido.', summary: '- Resumo ficticio.' }));
  render(<App />);
  fireEvent.click(await screen.findByText('Gravar'));
  fireEvent.click(await screen.findByText('Parar'));
  expect(await screen.findByText('Geracao incompleta. Tente novamente.')).toBeInTheDocument();
  expect(screen.getByText('Transcricao inteiramente ficticia.', { selector: '.text-display' })).toBeInTheDocument();
  expect(screen.getByText('Salvar Registro')).toBeEnabled();
  fireEvent.click(screen.getByText('Tentar geracao novamente'));
  expect(await screen.findByText('- Resumo ficticio.')).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/speech/transcribe'))).toHaveLength(1);
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ text: 'Transcricao inteiramente ficticia.' });
  expect(stopTrack).toHaveBeenCalled();
});
