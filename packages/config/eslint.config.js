import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

/** Config base compartida por todo el monorepo. */
export const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.config.js'],
  },
)

export const node = tseslint.config(...base, {
  languageOptions: { globals: globals.node },
})

export const react = tseslint.config(...base, {
  languageOptions: { globals: globals.browser },
})

/**
 * Fronteras de módulo del monolito modular (AGENTS.md §4).
 *
 * Dos invariantes:
 *  1. Un módulo NUNCA importa el interior de otro módulo. Solo su API pública
 *     (`../<otro>/index.ts`) o eventos de dominio.
 *  2. Las dependencias apuntan hacia adentro: `domain` no conoce `infrastructure`
 *     ni `interface`; `application` no conoce `interface`.
 *
 * Se aplica con rutas relativas porque los módulos viven en el mismo paquete.
 */
export const modularMonolith = [
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interface/**', '**/application/**'],
              message:
                'El dominio no puede depender de application/infrastructure/interface. Define un puerto (interfaz) en domain/ports.',
            },
            {
              group: ['@nestjs/*', 'drizzle-orm', '@supabase/*'],
              message:
                'El dominio debe ser TypeScript puro, sin framework ni SDKs. Muévelo a application/ o infrastructure/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/interface/**'],
              message: 'La capa de aplicación no puede depender de la capa de interfaz (HTTP).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../*/domain/**',
                '../*/infrastructure/**',
                '../*/application/**',
                '../../modules/*/domain/**',
                '../../modules/*/infrastructure/**',
                '../../modules/*/application/**',
              ],
              message:
                'Frontera de módulo violada. Un módulo solo puede importar el index.ts (API pública) de otro, o reaccionar a un evento de dominio.',
            },
          ],
        },
      ],
    },
  },
]

export default base
