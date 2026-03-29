import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async correctTranscript(text: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Corrija este texto transcrito de uma avaliacao tecnica psicossocial de adolescente em conflito com a lei, em portugues brasileiro.

Instrucoes:
- Corrija erros de ortografia, pontuacao e formatacao
- Padronize termos tecnicos juridicos e psicossociais (ECA, medidas socioeducativas, ato infracional, etc.)
- Mantenha o conteudo original intacto, apenas melhore a legibilidade
- Nao adicione informacoes que nao estejam no texto original
- Nao use formatacao markdown, retorne apenas texto simples

Texto a corrigir:
${text}

Texto corrigido:`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text.trim();
      }

      return text;
    } catch (err) {
      console.error('Claude correctTranscript error:', err);
      return text; // Return original on error
    }
  }

  async generateSummary(text: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Gere um resumo estruturado desta avaliacao tecnica de adolescente em conflito com a lei, para subsidiar relatorio ao juiz. Em portugues brasileiro.

Instrucoes:
- Seja conciso e objetivo
- Identifique os pontos principais mencionados
- Use formato de lista simples com marcadores (-)
- Nao invente informacoes que nao estejam no texto
- Se alguma categoria nao tiver informacao, omita-a
- NAO inclua titulos como "Resumo:" no inicio - comece direto com o conteudo

Categorias a considerar (se presentes no texto):
- Identificacao do adolescente
- Ato infracional em questao
- Contexto familiar
- Situacao escolar/ocupacional
- Fatores de risco identificados
- Fatores de protecao identificados
- Comportamento durante a avaliacao
- Consideracoes tecnicas

Texto da avaliacao:
${text}`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        // Remove any leading "Resumo:" or similar labels
        let summary = content.text.trim();
        summary = summary.replace(/^(Resumo:?\s*)/i, '');
        return summary.trim();
      }

      return '';
    } catch (err) {
      console.error('Claude generateSummary error:', err);
      return ''; // Return empty on error
    }
  }

  async processTranscript(text: string): Promise<{ correctedTranscript: string; summary: string }> {
    try {
      const [correctedTranscript, summary] = await Promise.all([
        this.correctTranscript(text),
        this.generateSummary(text),
      ]);

      return { correctedTranscript, summary };
    } catch (err) {
      console.error('Claude processTranscript error:', err);
      // Fallback: return original text without AI processing
      return { correctedTranscript: text, summary: '' };
    }
  }
}
