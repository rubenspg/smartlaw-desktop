import { defineConfig } from 'vitest/config';

const TEST_DB =
  process.env.TEST_DATABASE_URL ??
  'postgresql://smartlaw:smartlaw-pass@127.0.0.1:5432/smartlaw_test';

// Definido no processo principal, não só em `test.env`: o globalSetup roda
// aqui e precisa da URL antes dos workers existirem.
process.env.DATABASE_URL = TEST_DB;
process.env.JWT_SECRET ??= 'jwt-secret-de-teste-com-mais-de-32-caracteres';

export default defineConfig({
  test: {
    include: ['apps/server/src/**/*.itest.ts'],
    environment: 'node',
    globals: false,
    globalSetup: ['apps/server/test/global-setup.ts'],
    // Os arquivos compartilham um único banco e cada um limpa as tabelas:
    // rodar em paralelo faria um apagar as fixtures do outro.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DB,
      JWT_SECRET: 'jwt-secret-de-teste-com-mais-de-32-caracteres',
      NODE_ENV: 'test',
    },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
