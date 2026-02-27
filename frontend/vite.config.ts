import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
    proxy: {
      // 1. TELEMETRY (Port 8080)
      '/api/v1/debug': { target: 'http://localhost:8080', changeOrigin: true, secure: false },
      // 2. INGESTION (Port 8081)
      '/api/v1/ingestion': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      // 3. ANALYSIS (Port 8082)
      '/api/v1/analysis': { target: 'http://localhost:8082', changeOrigin: true, secure: false },
      // 4. USER PROFILES (Port 8083)
      '/api/v1/users': { target: 'http://localhost:8083', changeOrigin: true, secure: false },

      // WEBSOCKETS (Port 8080)
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})