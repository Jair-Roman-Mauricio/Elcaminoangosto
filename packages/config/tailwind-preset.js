/**
 * Preset de Tailwind — El Camino Angosto
 *
 * Tokens derivados literalmente de la landing real (docs/legacy-landing/styles.css).
 * Fuente de verdad: docs/DESIGN.md. Decisión: docs/decisiones.md → ADR-001.
 *
 * No añadas colores, tamaños ni curvas fuera de este archivo.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    // Sobrescribe la escala de Tailwind: la app es oscura y monocromática.
    screens: {
      xs: '479px',
      sm: '767px',
      cine: '820px', // breakpoint propio de la landing
      md: '991px',
      xl: '1600px',
    },
    extend: {
      colors: {
        negro: '#0a0a0a',
        hueso: '#f7f6f2',
        vino: '#b41e44',
        marino: '#1b3460',

        // Superficies elevadas (extensión para la app)
        superficie: {
          0: '#0a0a0a',
          1: '#101010',
          2: '#181818',
        },

        // Derivados del hueso, como opacidades fijas
        texto: {
          DEFAULT: '#f7f6f2',
          tenue: 'rgba(247, 246, 242, 0.55)',
          debil: 'rgba(247, 246, 242, 0.35)',
        },
        linea: {
          DEFAULT: 'rgba(247, 246, 242, 0.15)',
          fuerte: 'rgba(247, 246, 242, 0.40)',
        },

        // Semánticos de estado
        exito: '#2e7d5b',
        aviso: '#c9862b',
        peligro: '#b41e44', // = vino
      },

      fontFamily: {
        mono: ['"Space Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
        serif: ['Newsreader', 'Georgia', '"Times New Roman"', 'serif'],
      },

      // Escala tipográfica sobre base 16px. Ver DESIGN.md §3.
      fontSize: {
        eyebrow: ['0.625rem', { lineHeight: '1', letterSpacing: '0.14em' }],
        label: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.14em' }],
        'body-s': ['0.8125rem', { lineHeight: '1.5' }],
        body: ['1rem', { lineHeight: '1.5' }],
        'body-l': ['1.125rem', { lineHeight: '1.5' }],
        'h-s': ['1.25rem', { lineHeight: '1.3', letterSpacing: '0.01em' }],
        'h-m': ['1.5rem', { lineHeight: '1.25', letterSpacing: '0.01em' }],
        'h-l': ['2rem', { lineHeight: '1.2', letterSpacing: '0.01em' }],
        'h-xl': ['clamp(1.6rem, 3.5vw, 3.2rem)', { lineHeight: '1.12', letterSpacing: '0.01em' }],
        display: ['clamp(2rem, 6vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '0.01em' }],
        verse: ['clamp(1.0625rem, 1.55vw, 1.6rem)', { lineHeight: '1.55' }],
      },

      letterSpacing: {
        label: '0.14em',
        boton: '0.10em',
        titulo: '0.01em',
      },

      spacing: {
        'aire-xs': '0.75rem',
        'aire-s': '1.25rem',
        'aire-m': '2rem',
        'aire-l': '3.5rem',
        gutter: 'clamp(1.5rem, 5vw, 5rem)',
      },

      borderRadius: {
        DEFAULT: '0.8rem',
      },

      borderColor: {
        DEFAULT: 'rgba(247, 246, 242, 0.15)',
      },

      // Curva única: ease-out lento, SIN rebote. No añadas otras.
      transitionTimingFunction: {
        camino: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      transitionDuration: {
        fade: '900ms',
        'fade-corto': '250ms', // prefers-reduced-motion
      },
    },
  },
  plugins: [],
}
