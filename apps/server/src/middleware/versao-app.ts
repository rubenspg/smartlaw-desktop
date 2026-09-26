import type { MiddlewareHandler } from 'hono';

/**
 * Versão mínima do app desktop que esta API aceita.
 *
 * Suba este valor no mesmo PR que mudar o formato de uma resposta de modo que
 * versões antigas quebrem. Foi o que aconteceu com o envelope de paginação
 * (b1675815): o app 0.1.0 continuou chamando `.map` na resposta e a tela de
 * Processos caía em "Ocorreu um erro inesperado", sem nada dizer ao usuário
 * que bastava atualizar. Com o 426 abaixo, o app mostra a tela de atualização
 * obrigatória em vez de quebrar.
 *
 * Começa em 0.0.0 (nenhuma exigência): nenhuma versão com o cabeçalho quebrou
 * ainda. Nunca coloque acima da versão atual do app (tauri.conf.json), senão o
 * próprio `./dev.sh` recebe 426.
 *
 * Não é controle de segurança: o cabeçalho é declarado pelo próprio cliente.
 */
export const VERSAO_MINIMA_APP = '0.0.0';

export const CABECALHO_VERSAO_APP = 'X-App-Version';

/** `"0.3.0"` → `[0, 3, 0]`; `null` se não for uma versão reconhecível. */
function partes(versao: string): number[] | null {
  const nucleo = versao.trim().replace(/^v/, '').split(/[-+]/)[0];
  const numeros = nucleo.split('.').map(Number);
  if (numeros.length === 0 || numeros.some((n) => !Number.isInteger(n) || n < 0)) {
    return null;
  }
  return numeros;
}

/** Negativo se `a < b`, zero se iguais, positivo se `a > b`. */
export function compararVersoes(a: string, b: string): number {
  const pa = partes(a) ?? [];
  const pb = partes(b) ?? [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Recusa com 426 os apps abaixo da versão mínima.
 *
 * Requisições sem o cabeçalho passam: navegador, scripts, curl e os apps
 * anteriores ao 0.3.0, que ainda não o enviam. Esses apps antigos não sabem
 * interpretar o 426 de qualquer forma — para eles a saída é a instalação
 * manual, uma única vez, da primeira versão com o atualizador.
 */
export function exigirVersaoMinima(minima = VERSAO_MINIMA_APP): MiddlewareHandler {
  return async (c, next) => {
    const versao = c.req.header(CABECALHO_VERSAO_APP);
    if (versao && partes(versao) && compararVersoes(versao, minima) < 0) {
      return c.json(
        {
          error: 'Esta versão do SmartLaw está desatualizada. Atualize o app para continuar.',
          code: 'APP_DESATUALIZADO',
          versaoMinima: minima,
        },
        426,
      );
    }
    await next();
  };
}
