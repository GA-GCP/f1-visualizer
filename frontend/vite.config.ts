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
  build: {
    rolldownOptions: {
      output: {
        // `entriesAware` names its subgroups `group~entry~entry~...`, which
        // produces 90-character filenames that leak route names into URLs.
        // Keep the group prefix and let the hash do the disambiguating.
        chunkFileNames: (chunk: { name: string }) =>
          `assets/${chunk.name.split('~')[0]}-[hash].js`,
        // Vite 8 / rolldown: this replaces Rollup's `manualChunks`.
        //
        // The point is cache lifetime, not chunk count: with one bundle every
        // deploy invalidated all vendor code, so a returning user re-downloaded
        // React, MUI, d3 and Auth0 to pick up an app-only change. Splitting them
        // out keeps their hashes stable across app-only deploys.
        //
        // `[\\/]` rather than `/` so the patterns also match on Windows, and each
        // alternation is anchored with a trailing separator so `react` does not
        // also swallow `react-router-dom`.
        codeSplitting: {
          // `entriesAware` keeps the vendor grouping from undoing the route
          // splitting: without it, every @mui module in the build lands in one
          // chunk that the public route statically preloads, so Dialog,
          // Autocomplete and Slider — reachable only from lazy routes — ship
          // before login anyway. With it, modules shared by all entries stay in
          // the common chunk and the rest follow the routes that use them.
          // The merge threshold stops that producing a spray of tiny chunks.
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 20_000,
            },
            {
              // Emotion and Popper are MUI's own runtime; they version together
              // with it, so they belong in the same chunk.
              name: 'mui',
              test: /node_modules[\\/](@mui|@emotion|@popperjs)[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 20_000,
            },
            {
              name: 'auth0',
              test: /node_modules[\\/]@auth0[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 20_000,
            },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 20_000,
            },
            {
              // d3 ships as ~30 scoped packages plus a few shared helpers.
              name: 'd3',
              test: /node_modules[\\/](d3(-[a-z0-9]+)?|internmap|delaunator|robust-predicates)[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 20_000,
            },
            {
              // Only reachable behind the auth guard; kept together so it can be
              // dropped in one go when SockJS goes away.
              name: 'realtime',
              test: /node_modules[\\/](@stomp|sockjs-client)[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 20_000,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 1. INGESTION (Port 8081)
      '/api/v1/ingestion': { target: 'http://localhost:8081', changeOrigin: true, secure: false },
      // 2. ANALYSIS (Port 8082)
      '/api/v1/analysis': { target: 'http://localhost:8082', changeOrigin: true, secure: false },
      // 3. USER PROFILES (Port 8083)
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