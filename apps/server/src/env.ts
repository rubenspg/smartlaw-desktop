import * as dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Valida as variáveis obrigatórias na subida do processo.
 *
 * Falhar aqui é intencional: um JWT_SECRET ausente ou fraco assinaria tokens
 * adivinháveis silenciosamente.
 */
function requireEnv(): { DATABASE_URL: string; JWT_SECRET: string; PORT: number } {
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

  if (errors.length > 0) {
    console.error('[Config] Configuração inválida:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  return { DATABASE_URL: DATABASE_URL!, JWT_SECRET: JWT_SECRET!, PORT };
}

export const env = requireEnv();
