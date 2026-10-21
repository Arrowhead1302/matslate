import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  // The finished website goes in /docs, which GitHub Pages publishes.
  build: { outDir: 'docs', emptyOutDir: true },
})
