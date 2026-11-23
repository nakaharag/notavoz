import { HttpException } from '@nestjs/common';

export function apiError(code: string, message: string, status = 502, retryable = false): HttpException {
  return new HttpException({ code, message, retryable }, status);
}

// Fixed official origin. Tests mock fetch; deployment cannot redirect credentials.
export async function openaiRequest(endpoint: string, body: BodyInit, json = false): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw apiError('PROVIDER_CREDENTIAL', 'Configure a credencial OpenAI.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const code = data?.error?.code;
      if (response.status === 401 || response.status === 403) throw apiError('PROVIDER_CREDENTIAL', 'Credencial OpenAI invalida ou sem permissao.');
      if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') throw apiError('PROVIDER_QUOTA', 'Cota OpenAI esgotada. Verifique o faturamento.');
      if (response.status === 429) throw apiError('PROVIDER_RATE_LIMIT', 'Limite OpenAI atingido. Tente novamente mais tarde.', 429, true);
      if (code === 'model_not_found' || response.status === 404) throw apiError('PROVIDER_MODEL', 'Modelo indisponivel. Verifique a configuracao e o acesso.');
      if (response.status === 408 || response.status === 504) throw apiError('PROVIDER_TIMEOUT', 'Tempo da OpenAI esgotado. Tente novamente.', 504, true);
      if (response.status === 400 || response.status === 422) throw apiError('INVALID_INPUT', 'Entrada ou parametros rejeitados pela OpenAI.', 400);
      throw apiError('PROVIDER_UNAVAILABLE', 'OpenAI indisponivel. Tente novamente.', 502, true);
    }
    if (!data) throw apiError('PROVIDER_RESPONSE', 'Resposta OpenAI invalida. Tente novamente.', 502, true);
    return data;
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (controller.signal.aborted) throw apiError('PROVIDER_TIMEOUT', 'Tempo da OpenAI esgotado. Tente novamente.', 504, true);
    throw apiError('PROVIDER_UNAVAILABLE', 'Falha de conexao com OpenAI. Tente novamente.', 502, true);
  } finally {
    clearTimeout(timer);
  }
}
