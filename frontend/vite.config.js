import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development every request to /api is forwarded to the FastAPI
// backend, so the browser never has CORS problems.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
