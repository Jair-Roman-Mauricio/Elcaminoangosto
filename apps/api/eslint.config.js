import { node, modularMonolith } from '@elcamino/config/eslint'

export default [
  ...node,
  ...modularMonolith,
  {
    rules: {
      /**
       * NestJS resuelve la inyección leyendo los tipos del constructor en
       * runtime (`emitDecoratorMetadata`). Un `import type` los borra del
       * JS emitido y la DI falla en arranque, no en compilación.
       * Por eso esta regla se desactiva aquí y solo aquí.
       */
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
]
