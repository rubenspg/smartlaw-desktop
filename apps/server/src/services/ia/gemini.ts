/**
 * Client mínimo do Google AI (Gemini) pela API REST, sem SDK: é um único POST.
 * A chave (GOOGLE_API_KEY) só existe no servidor e nunca vai ao app.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface UsoGemini {
  tokensEntrada: number;
  /** Resposta mais raciocínio: os dois são cobrados como saída. */
  tokensSaida: number;
  /** Estimativa em US$, ou null para um modelo fora da tabela. */
  custoUsd: number | null;
}

// US$ por 1M de tokens (entrada, saída), tier pago padrão.
const PRECOS: Record<string, [number, number]> = {
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.1-flash-lite': [0.25, 1.5],
};

interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

export function usoDe(modelo: string, meta: UsageMetadata | undefined): UsoGemini {
  const tokensEntrada = meta?.promptTokenCount ?? 0;
  const tokensSaida = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
  const preco = PRECOS[modelo];
  return {
    tokensEntrada,
    tokensSaida,
    custoUsd: preco ? (tokensEntrada * preco[0] + tokensSaida * preco[1]) / 1_000_000 : null,
  };
}

interface OpcoesGeracao {
  apiKey: string;
  modelo: string;
  instrucao: string;
  maxTokensSaida?: number;
  aoMedirUso?: (uso: UsoGemini) => void;
}

interface Parte {
  text?: string;
  thought?: boolean;
}

interface RespostaGemini {
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
  usageMetadata?: UsageMetadata;
  candidates?: { finishReason?: string; content?: { parts?: Parte[] } }[];
}

/** Pede uma resposta em JSON. Lança GeminiError em qualquer falha do provedor. */
export async function gerarJson(prompt: string, o: OpcoesGeracao): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    // O raciocínio sai do mesmo orçamento: folga acima do tamanho esperado.
    maxOutputTokens: o.maxTokensSaida ?? 2048,
    responseMimeType: 'application/json',
    // "low" basta para narrar números prontos e corta tokens de saída.
    thinkingConfig: { thinkingLevel: 'low' },
  };
  const corpo = {
    systemInstruction: { parts: [{ text: o.instrucao }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };

  const post = async (body: unknown): Promise<Response> => {
    try {
      return await fetch(`${API_BASE}/${o.modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': o.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new GeminiError(`Sem conexão com o Google AI: ${err instanceof Error ? err.message : 'erro de rede'}`, 502);
    }
  };

  let res = await post(corpo);
  // Nem todo modelo aceita thinkingConfig; é só otimização, então tenta sem.
  if (res.status === 400) {
    const { thinkingConfig: _ignorado, ...resto } = generationConfig;
    res = await post({ ...corpo, generationConfig: resto });
  }

  const bruto = await res.text();
  let json: RespostaGemini | null = null;
  try {
    json = bruto ? (JSON.parse(bruto) as RespostaGemini) : null;
  } catch {
    // cai no erro genérico abaixo
  }

  if (!res.ok) {
    throw new GeminiError(json?.error?.message || res.statusText || `HTTP ${res.status}`, res.status);
  }
  if (json?.promptFeedback?.blockReason) {
    throw new GeminiError(`Pedido bloqueado pelo Google AI (${json.promptFeedback.blockReason}).`, 422);
  }

  o.aoMedirUso?.(usoDe(o.modelo, json?.usageMetadata));

  const candidato = json?.candidates?.[0];
  // Modelos com raciocínio intercalam partes `thought`, que não são a resposta.
  const texto = (candidato?.content?.parts ?? [])
    .filter((p) => p.thought !== true)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!texto) {
    throw new GeminiError(`Resposta vazia do Google AI (${candidato?.finishReason ?? 'sem motivo'}).`, 502);
  }
  return texto;
}
