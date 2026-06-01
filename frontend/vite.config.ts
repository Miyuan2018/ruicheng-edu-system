import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = process.env.BACKEND_PORT || '8001';
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3001', 10);

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    proxy: {
      '/api': {
        target: `http://${BACKEND_HOST}:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
    // Allow connections from Docker/host network
    watch: {
      usePolling: true,
    },
  },
  cacheDir: process.env.HOME + '/.cache/vite-edu',
})
