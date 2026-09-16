import { describe, it, expect, beforeEach } from 'vitest';
import {
  verificarLimiteLogin,
  registrarFalhaLogin,
  limparFalhasLogin,
  ipDoCliente,
  _resetRateLimitState,
  JANELA_MS,
  MAX_FALHAS,
} from './rate-limit';

/** Instante fixo: o limitador aceita `agora` para que a janela seja testável sem esperar. */
const T0 = 1_000_000_000_000;

const falharVezes = (n: number, ip = '1.1.1.1', email = 'a@b.c', agora = T0) => {
  for (let i = 0; i < n; i++) registrarFalhaLogin(ip, email, agora);
};

beforeEach(() => _resetRateLimitState());

describe('janela de tempo', () => {
  it('permite até o limite', () => {
    falharVezes(MAX_FALHAS - 1);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0).permitido).toBe(true);
  });

  it('bloqueia ao atingir o limite', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0).permitido).toBe(false);
  });

  it('continua bloqueado 1ms antes de vencer', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0 + JANELA_MS - 1).permitido).toBe(false);
  });

  it('libera exatamente quando a janela vence', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0 + JANELA_MS).permitido).toBe(true);
  });

  it('falha após a janela vencida começa uma contagem nova', () => {
    falharVezes(MAX_FALHAS);
    registrarFalhaLogin('1.1.1.1', 'a@b.c', T0 + JANELA_MS + 1);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0 + JANELA_MS + 1).permitido).toBe(true);
  });
});

describe('Retry-After', () => {
  it('reporta a janela inteira logo após o bloqueio', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0).retryAfter).toBe(JANELA_MS / 1000);
  });

  it('decresce conforme o tempo passa', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0 + 60_000).retryAfter).toBe(
      JANELA_MS / 1000 - 60,
    );
  });
});

describe('isolamento de chaves', () => {
  it('não afeta outro IP', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('2.2.2.2', 'a@b.c', T0).permitido).toBe(true);
  });

  it('não afeta outro e-mail no mesmo IP', () => {
    falharVezes(MAX_FALHAS);
    expect(verificarLimiteLogin('1.1.1.1', 'x@y.z', T0).permitido).toBe(true);
  });

  // Se o e-mail não fosse normalizado, alternar maiúsculas daria tentativas infinitas.
  it('normaliza maiúsculas e espaços do e-mail', () => {
    falharVezes(MAX_FALHAS, '1.1.1.1', 'Admin@Smartlaw.COM');
    expect(verificarLimiteLogin('1.1.1.1', '  admin@smartlaw.com  ', T0).permitido).toBe(false);
  });
});

describe('reset após acerto', () => {
  it('limparFalhasLogin zera a contagem', () => {
    falharVezes(MAX_FALHAS);
    limparFalhasLogin('1.1.1.1', 'a@b.c');
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0).permitido).toBe(true);
  });

  // O caso cotidiano: erra a senha algumas vezes, acerta, e não fica "quase bloqueado".
  it('errar, acertar e errar de novo não acumula rumo ao bloqueio', () => {
    falharVezes(MAX_FALHAS - 1);
    limparFalhasLogin('1.1.1.1', 'a@b.c');
    falharVezes(MAX_FALHAS - 1);
    expect(verificarLimiteLogin('1.1.1.1', 'a@b.c', T0).permitido).toBe(true);
  });
});

describe('IP do cliente', () => {
  it('prefere CF-Connecting-IP, escrito pela borda e não forjável de fora', () => {
    expect(ipDoCliente({ cfConnectingIp: '9.9.9.9', xForwardedFor: '1.2.3.4' })).toBe('9.9.9.9');
  });

  it('usa o primeiro salto de X-Forwarded-For', () => {
    expect(ipDoCliente({ xForwardedFor: '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4');
  });

  it('cai para "desconhecido" sem cabeçalho', () => {
    expect(ipDoCliente({})).toBe('desconhecido');
  });

  it('ignora cabeçalho vazio em vez de virar chave em branco', () => {
    expect(ipDoCliente({ xForwardedFor: '   ' })).toBe('desconhecido');
  });
});

describe('teto de memória', () => {
  // Sem poda, variar o e-mail transformaria o limitador em vazamento de memória.
  it('não cresce sem limite sob e-mails variados', () => {
    for (let i = 0; i < 12_000; i++) {
      registrarFalhaLogin(`10.0.${i % 255}.${i % 97}`, `u${i}@x.c`, T0);
    }
    // Ainda funcional depois da poda.
    falharVezes(MAX_FALHAS, '5.5.5.5', 'z@z.z');
    expect(verificarLimiteLogin('5.5.5.5', 'z@z.z', T0).permitido).toBe(false);
  });
});
