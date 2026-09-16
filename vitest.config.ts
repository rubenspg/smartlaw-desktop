import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testes ficam ao lado do código que exercitam, não numa árvore paralela:
    // quem edita a função enxerga o teste no mesmo diretório.
    include: ['apps/**/src/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    // *.itest.ts exige Postgres e roda em vitest.integration.config.ts.
    exclude: ['**/node_modules/**', '**/*.itest.ts'],
    environment: 'node',
    // Sem `globals: true` de propósito — describe/it/expect são importados
    // explicitamente, o que dispensa configurar globais no ESLint e no tsc.
    globals: false,
  },
});
