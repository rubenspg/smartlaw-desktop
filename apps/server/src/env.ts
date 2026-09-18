import * as dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Valida as variáveis obrigatórias na subida do processo.
 *
 * Falhar aqui é intencional: um JWT_SECRET ausente ou fraco assinaria tokens
 * adivinháveis silenciosamente.
 */
type DjenTransport = 'direct' | 'relay';

interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT: number;
  /** Ver docs/INTEGRACAO_TRIBUNAIS_INSS.md §5-6. `direct` é o padrão. */
  DJEN_TRANSPORT: DjenTransport;
  BR_RELAY_URL: string | null;
  BR_RELAY_TOKEN: string | null;
}

function requireEnv(): Env {
  const errors: string[] = [];

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    errors.push('DATABASE_URL não está definida.');
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    errors.push('JWT_SECRET não está definida.');
  } else if (JWT_SECRET.length < JWT_SECRET_MIN_LENGTH) {
    errors.push(`JWT_SECRET precisa ter ao menos ${JWT_SECRET_MIN_LENGTH} caracteres (tem ${JWT_SECRET.length}).`);
  }

  const PORT = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(PORT) || PORT <= 0) {
    errors.push(`PORT inválida: ${process.env.PORT}`);
  }

  // Opcionais do DJEN: validam o tipo, não exigem presença.
  const DJEN_TRANSPORT = (process.env.DJEN_TRANSPORT?.trim() || 'direct') as DjenTransport;
  if (DJEN_TRANSPORT !== 'direct' && DJEN_TRANSPORT !== 'relay') {
    errors.push(`DJEN_TRANSPORT inválido: ${process.env.DJEN_TRANSPORT} (use direct ou relay).`);
  }
  const BR_RELAY_URL = process.env.BR_RELAY_URL?.trim() || null;
  const BR_RELAY_TOKEN = process.env.BR_RELAY_TOKEN?.trim() || null;
  if (DJEN_TRANSPORT === 'relay' && !BR_RELAY_URL) {
    errors.push('BR_RELAY_URL é obrigatória quando DJEN_TRANSPORT=relay.');
  }

  if (errors.length > 0) {
    console.error('[Config] Configuração inválida:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  return { DATABASE_URL: DATABASE_URL!, JWT_SECRET: JWT_SECRET!, PORT, DJEN_TRANSPORT, BR_RELAY_URL, BR_RELAY_TOKEN };
}

export const env = requireEnv();
