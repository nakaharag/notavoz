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
        system: `Voce corrige transcricoes de audio de pareceres psicossociais. Corrija ortografia, pontuacao e padronize termos tecnicos juridicos e psicossociais (ECA, medidas socioeducativas, ato infracional, etc.). Mantenha o tom original. Retorne somente o texto corrigido.`,
        messages: [
          {
            role: 'user',
            content: text,
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
            content: `Gere um resumo estruturado deste texto em portugues brasileiro. O contexto e uma avaliacao tecnica psicossocial.

Instrucoes:
- Seja conciso e objetivo
- Identifique os pontos principais mencionados
- Use formato de lista simples com marcadores (-)
- Nao invente informacoes que nao estejam no texto
- Se nenhuma categoria se aplicar, faca um resumo simples do conteudo
- NAO inclua titulos como "Resumo:" no inicio - comece direto com o conteudo
- Se o texto for muito curto ou simples, apenas resuma o que foi dito

Categorias a considerar (se presentes no texto):
- Identificacao do avaliado
- Situacao em questao
- Contexto familiar
- Situacao escolar/ocupacional
- Fatores de risco identificados
- Fatores de protecao identificados
- Comportamento durante a avaliacao
- Consideracoes tecnicas

Texto:
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
