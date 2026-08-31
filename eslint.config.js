import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/src-tauri/target/**',
      // Gerado pelo TanStack Router — não editar nem lintar.
      'apps/desktop/src/routeTree.gen.ts',
      // Componentes shadcn são copiados upstream; manter o diff limpo.
      'apps/desktop/src/components/ui/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // Foi exatamente esta regra que teria pego os imports mortos do
      // docxtemplater em settings/index.tsx.
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],

      // O código atual tem ~54 `as any`; deixar como aviso para não travar o
      // build enquanto #27 não os elimina.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Frontend
  {
    files: ['apps/desktop/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // O formulário de configurações espelha dados do servidor em estado local
      // via efeito. Corrigir exige remodelar o formulário — rastreado em #29.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Backend e scripts
  {
    files: ['apps/server/**/*.ts', 'scripts/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Arquivos de configuração rodam em Node.
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
