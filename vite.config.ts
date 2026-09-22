import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Web Serial / geolocation need a secure context; for LAN demo access
    // over HTTPS use `vite --host` with a trusted cert. Localhost is fine
    // for USB Web Serial during recording.
    host: true,
  },
})
