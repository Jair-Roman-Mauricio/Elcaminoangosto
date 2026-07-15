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
        // Acentos de marca y absolutos: fijos, no cambian con el tema.
        negro: '#0a0a0a',
        hueso: '#f7f6f2',
        vino: '#b41e44',
        marino: '#1b3460',

        // ── Tokens SEMÁNTICOS: cambian con el tema (ver tokens.css, ADR-007) ──
        // Fondo de página y contenido (texto) principal.
        fondo: 'var(--fondo)',
        contenido: {
          DEFAULT: 'var(--contenido)',
          tenue: 'var(--contenido-tenue)',
          debil: 'var(--contenido-debil)',
        },

        // Superficies elevadas (tarjetas, modales, player bar).
        superficie: {
          0: 'var(--superficie-0)',
          1: 'var(--superficie-1)',
          2: 'var(--superficie-2)',
        },

        // Alias heredados: misma semántica que `contenido`, ahora theme-aware.
        texto: {
          DEFAULT: 'var(--contenido)',
          tenue: 'var(--contenido-tenue)',
          debil: 'var(--contenido-debil)',
        },
        linea: {
          DEFAULT: 'var(--linea)',
          fuerte: 'var(--linea-fuerte)',
        },

        // Semánticos de estado (constantes sobre ambos temas)
        exito: '#2e7d5b',
        aviso: '#c9862b',
        peligro: '#b41e44', // = vino
      },

      fontFamily: {
        mono: ['"Space Mono"', 'ui-monospace', '"SFMono-Regular"', 'Menlo', 'monospace'],
        ui: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
        DEFAULT: 'var(--linea)',
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
  plugins: [
    // Oculta la barra de scroll del feed vertical sin perder el desplazamiento.
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })
    },
  ],
}
