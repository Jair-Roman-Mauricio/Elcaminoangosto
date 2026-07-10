import preset from '@elcamino/config/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // El design system trae sus propias clases; Tailwind debe verlas.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
}
