// Explicit smoke-only preload; never included in a production image.
const realFetch = global.fetch;
global.fetch = async (url, options) => {
  if (!String(url).startsWith('https://api.openai.com/v1/')) return realFetch(url, options);
  if (String(url).endsWith('/audio/transcriptions')) {
    return new Response(JSON.stringify({ text: 'Transcricao sintetica do smoke test.' }));
  }
  const body = JSON.parse(options.body);
  if (body.input[0].content === 'SIMULATE_MODEL_ERROR') {
    return new Response(JSON.stringify({ error: { code: 'model_not_found' } }), { status: 404 });
  }
  return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{
    type: 'output_text', text: JSON.stringify({ correctedTranscript: 'Texto sintetico corrigido.', summary: '- Exemplo ficticio.' }),
  }] }] }));
};
