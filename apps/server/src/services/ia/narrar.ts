import { chaveCache, gravarCache, lerCache } from './cache';
import { gerarJson, GeminiError, type UsoGemini } from './gemini';
import { lerNarracao, numerosNaoSuportados, textoDaNarracao, type Narracao } from './narracao';

export interface ResultadoNarracao {
  narracao: Narracao;
  origem: 'ia' | 'calculado';
  /** Números que o modelo usou e que não estavam no payload, quando recusado. */
  recusados: string[];
  uso: UsoGemini[];
  /** Soma das tentativas; null se algum modelo estiver fora da tabela de preços. */
  custoUsd: number | null;
  modelo: string;
  /** Exatamente o que foi (ou seria) enviado, para a tela mostrar. */
  enviado: unknown;
  cache: boolean;
  /** Por que o texto calculado foi usado, quando não foi pela conferência. */
  motivo?: string;
}

export interface OpcoesNarrar {
  firmId: string;
  /** Namespace do cache, ex.: "insights:processos". */
  tarefa: string;
  instrucao: string;
  /** Primeira linha do prompt; o payload vai em JSON logo abaixo. */
  pergunta: string;
  payload: unknown;
  /** Texto calculado, usado quando o modelo falha ou erra um número. */
  reserva: Narracao;
  apiKey: string | null;
  modelo: string;
  /** Troca o Gemini nos testes. */
  gerar?: typeof gerarJson;
}

const soma = (uso: UsoGemini[]) =>
  uso.some((u) => u.custoUsd == null) ? null : uso.reduce((s, u) => s + (u.custoUsd ?? 0), 0);

/**
 * Pede ao Gemini que narre `payload`, sem deixar passar número não conferido.
 *
 * Resposta com número fora do payload, ou fora do JSON pedido, ganha uma nova
 * tentativa com o motivo; depois disso volta o texto calculado. O resultado
 * fica em cache pelo payload; falha do provedor não entra no cache, para uma
 * queda não fixar o texto calculado por um dia.
 */
export async function narrar(o: OpcoesNarrar): Promise<ResultadoNarracao> {
  const base = { modelo: o.modelo, enviado: o.payload };
  if (!o.apiKey) {
    return {
      ...base,
      narracao: o.reserva,
      origem: 'calculado',
      recusados: [],
      uso: [],
      custoUsd: null,
      cache: false,
      motivo: 'IA não configurada no servidor',
    };
  }

  const chave = chaveCache(o.firmId, o.tarefa, o.modelo, o.instrucao, o.payload);
  const guardado = lerCache<Omit<ResultadoNarracao, 'cache'>>(chave);
  if (guardado) return { ...guardado, cache: true };

  const gerar = o.gerar ?? gerarJson;
  const uso: UsoGemini[] = [];
  const prompt = `${o.pergunta}\n\n${JSON.stringify(o.payload, null, 2)}`;
  const opcoes = { apiKey: o.apiKey, modelo: o.modelo, instrucao: o.instrucao, aoMedirUso: (u: UsoGemini) => uso.push(u) };

  try {
    let narracao = lerNarracao(await gerar(prompt, opcoes));
    let recusados = narracao ? numerosNaoSuportados(textoDaNarracao(narracao), o.payload) : [];

    if (!narracao || recusados.length > 0) {
      const porque = narracao
        ? `Sua resposta anterior usou números que não estão nos dados: ${recusados.join(', ')}. Use só números copiados exatamente do JSON.`
        : 'Sua resposta anterior não era o JSON pedido.';
      narracao = lerNarracao(await gerar(`${prompt}\n\n${porque}`, opcoes));
      recusados = narracao ? numerosNaoSuportados(textoDaNarracao(narracao), o.payload) : [];
    }

    const resultado: Omit<ResultadoNarracao, 'cache'> =
      narracao && recusados.length === 0
        ? { ...base, narracao, origem: 'ia', recusados: [], uso, custoUsd: soma(uso) }
        : {
            ...base,
            narracao: o.reserva,
            origem: 'calculado',
            recusados,
            uso,
            custoUsd: soma(uso),
            motivo: recusados.length ? 'o texto da IA citava números fora dos dados' : 'a IA não respondeu no formato pedido',
          };
    if (resultado.origem === 'calculado') {
      console.warn(`[${o.tarefa}] texto da IA recusado (${recusados.length} número(s) fora dos dados); usando o calculado`);
    }
    gravarCache(chave, resultado);
    return { ...resultado, cache: false };
  } catch (err) {
    if (!(err instanceof GeminiError)) throw err;
    // Só status e mensagem do provedor; nunca o payload nem a chave.
    console.error(`[${o.tarefa}] Gemini ${err.status}: ${err.message}`);
    return {
      ...base,
      narracao: o.reserva,
      origem: 'calculado',
      recusados: [],
      uso,
      custoUsd: soma(uso),
      cache: false,
      motivo: 'serviço de IA indisponível',
    };
  }
}
