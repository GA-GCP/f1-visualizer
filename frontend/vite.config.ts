import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
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
      // 1. ROUTE ANALYSIS TRAFFIC TO PORT 8082
      '/api/v1/analysis': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
      },
      // 2. DEFAULT API TRAFFIC TO PORT 8080
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      // 3. WEBSOCKETS TO PORT 8080
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})