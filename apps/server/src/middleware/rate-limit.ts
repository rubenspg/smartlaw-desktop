/**
 * Limitador de tentativas de login, em memória.
 *
 * Sem isto, o único teto para adivinhar senhas é a CPU do servidor: o bcrypt
 * custa ~60ms por verificação, então uma lista de 10 mil senhas comuns se
 * esgota em minutos. Com a janela abaixo, a mesma lista levaria décadas.
 *
 * Também fecha um vetor de negação de serviço: cada tentativa força um bcrypt,
 * e tentativas ilimitadas saturam a CPU do container sem acertar senha nenhuma.
 *
 * Estado em memória é suficiente aqui porque a API roda em um único container.
 * Se um dia houver mais de uma instância, isto precisa virar Redis — cada
 * processo contaria em separado e o teto efetivo se multiplicaria.
 */

interface Bucket {
  falhas: number;
  expiraEm: number;
}

const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 5;

/**
 * Teto de chaves rastreadas. Sem isso, um atacante variando o e-mail cria
 * entradas indefinidamente e o limitador vira ele próprio um vazamento de
 * memória.
 */
const MAX_CHAVES = 10_000;

const buckets = new Map<string, Bucket>();

/**
 * IP do cliente. Atrás do Cloudflare, CF-Connecting-IP é escrito pela borda e
 * não pode ser forjado por quem passa por lá. X-Forwarded-For é o plano B e
 * *é* forjável por quem alcança a origem direto na LAN — daí a chave combinar
 * IP com e-mail, para que forjar o IP ainda esbarre no limite por conta.
 */
function ipDoCliente(headers: {
  cfConnectingIp?: string;
  xForwardedFor?: string;
}): string {
  if (headers.cfConnectingIp) return headers.cfConnectingIp.trim();
  const encaminhado = headers.xForwardedFor?.split(',')[0]?.trim();
  return encaminhado || 'desconhecido';
}

function chave(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

/** Remove entradas vencidas. Chamado quando o mapa cresce demais. */
function limpar(agora: number) {
  for (const [k, b] of buckets) {
    if (b.expiraEm <= agora) buckets.delete(k);
  }
  // Se ainda estiver cheio depois da limpeza, descarta as mais antigas.
  if (buckets.size >= MAX_CHAVES) {
    const ordenadas = [...buckets.entries()].sort((a, b) => a[1].expiraEm - b[1].expiraEm);
    for (const [k] of ordenadas.slice(0, Math.ceil(MAX_CHAVES / 10))) {
      buckets.delete(k);
    }
  }
}

export interface RateLimitResult {
  permitido: boolean;
  /** Segundos até liberar. Só faz sentido quando `permitido` é falso. */
  retryAfter: number;
}

export function verificarLimiteLogin(
  ip: string,
  email: string,
  agora: number = Date.now(),
): RateLimitResult {
  const b = buckets.get(chave(ip, email));

  if (!b || b.expiraEm <= agora) {
    return { permitido: true, retryAfter: 0 };
  }

  if (b.falhas >= MAX_FALHAS) {
    return { permitido: false, retryAfter: Math.ceil((b.expiraEm - agora) / 1000) };
  }

  return { permitido: true, retryAfter: 0 };
}

/** Conta uma tentativa malsucedida. */
export function registrarFalhaLogin(ip: string, email: string, agora: number = Date.now()) {
  if (buckets.size >= MAX_CHAVES) limpar(agora);

  const k = chave(ip, email);
  const b = buckets.get(k);

  if (!b || b.expiraEm <= agora) {
    buckets.set(k, { falhas: 1, expiraEm: agora + JANELA_MS });
    return;
  }

  b.falhas += 1;
}

/**
 * Zera o contador após um login bem-sucedido, para que o uso normal — errar a
 * senha e acertar em seguida — nunca acumule em direção ao bloqueio.
 */
export function limparFalhasLogin(ip: string, email: string) {
  buckets.delete(chave(ip, email));
}

/** Só para teste. */
export function _resetRateLimitState() {
  buckets.clear();
}

export { ipDoCliente, JANELA_MS, MAX_FALHAS };
