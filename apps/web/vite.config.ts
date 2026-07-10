import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // GSAP + Lenis solo se necesitan en la landing (ADR-003).
          // Aislarlos evita penalizar el bundle de la app.
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
