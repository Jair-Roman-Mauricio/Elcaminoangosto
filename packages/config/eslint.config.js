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
 * Fronteras del monolito modular (AGENTS.md §4).
 *
 * ⚠️ `no-restricted-imports` NO se fusiona entre bloques de flat config: el
 * último bloque que casa con el archivo sobrescribe a los anteriores. Por eso
 * cada capa declara la regla COMPLETA, componiendo los grupos que le aplican.
 * Separarlos en tres bloques dejaba la regla más específica sin efecto.
 */

/**
 * Invariante 1 — un módulo nunca importa el interior de otro.
 * Solo su `index.ts` (API pública) o un evento de dominio.
 *
 * Rutas reales:
 *   desde `<mod>/<capa>/x.ts` → hermano = `../../<otro>/<capa>/…`
 *   desde `<mod>/x.ts`        → hermano = `../<otro>/<capa>/…`
 * La capa propia (`../infrastructure/…`, `./domain/…`) tiene un solo segmento
 * y por eso no casa con estos patrones.
 */
const cruceDeModulos = [
  '../*/domain/**',
  '../*/application/**',
  '../*/infrastructure/**',
  '../*/interface/**',
  '../../*/domain/**',
  '../../*/application/**',
  '../../*/infrastructure/**',
  '../../*/interface/**',
]

const MSG_CRUCE =
  'Frontera de módulo violada. Un módulo solo puede importar el index.ts (API pública) de otro, o reaccionar a un evento de dominio.'

const restringir = (grupos) => ['error', { patterns: grupos }]

export const modularMonolith = [
  {
    // El dominio es TypeScript puro y no conoce las capas de afuera.
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restringir([
        { group: cruceDeModulos, message: MSG_CRUCE },
        {
          group: ['../infrastructure/**', '../interface/**', '../application/**'],
          message:
            'Las dependencias apuntan hacia adentro: el dominio no conoce application/infrastructure/interface. Define un puerto (interfaz) aquí.',
        },
        {
          group: ['@nestjs/*', 'drizzle-orm', 'drizzle-orm/*', '@supabase/*', 'postgres'],
          message:
            'El dominio debe ser TypeScript puro, sin framework ni SDKs. Muévelo a application/ o infrastructure/.',
        },
      ]),
    },
  },
  {
    // La aplicación orquesta; no conoce el transporte HTTP.
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': restringir([
        { group: cruceDeModulos, message: MSG_CRUCE },
        {
          group: ['../interface/**'],
          message: 'La capa de aplicación no puede depender de la capa de interfaz (HTTP).',
        },
      ]),
    },
  },
  {
    // Interface, infrastructure y la raíz del módulo: solo la regla de cruce.
    files: [
      'src/modules/*/interface/**/*.ts',
      'src/modules/*/infrastructure/**/*.ts',
      'src/modules/*/*.ts',
    ],
    rules: {
      'no-restricted-imports': restringir([{ group: cruceDeModulos, message: MSG_CRUCE }]),
    },
  },
  {
    // `shared` es el núcleo común: todos pueden usarlo, él no usa a nadie.
    files: ['src/modules/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': restringir([
        {
          group: ['../../*/domain/**', '../../*/application/**', '../../*/infrastructure/**'],
          message: '`shared` no puede depender de ningún bounded context.',
        },
      ]),
    },
  },
]

export default base
