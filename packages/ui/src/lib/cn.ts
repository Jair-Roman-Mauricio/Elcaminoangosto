import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Escala tipográfica del preset (`packages/config/tailwind-preset.js`, DESIGN.md
 * §3). Hay que declarársela a `tailwind-merge`: sin esto trata `text-eyebrow`
 * como un color de texto y lo elimina en cuanto la misma clase lleva un color
 * (`cn('text-eyebrow …', 'text-hueso')` devolvía solo `text-hueso`). El
 * componente perdía su tamaño y heredaba el del padre.
 *
 * Si añades un tamaño al preset, añádelo también aquí.
 */
const TAMANOS_DE_TEXTO = [
  'eyebrow',
  'label',
  'body-s',
  'body',
  'body-l',
  'h-s',
  'h-m',
  'h-l',
  'h-xl',
  'display',
  'verse',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TAMANOS_DE_TEXTO }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
