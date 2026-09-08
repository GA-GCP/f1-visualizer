import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    // The compiler is enabled here too, not just in vite.config.ts: without it
    // the suite would validate uncompiled components while production ships
    // compiled ones, and the compiler rewrites hook call order.
    plugins: [react({ compiler: true })],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        // Reuse one jsdom per worker instead of building 38 of them, which was
        // ~35% of wall time.
        //
        // NOT `isolate: false`: that shares the module graph across files too,
        // and userApi.test.ts then resolves the real axios client instead of its
        // vi.mock, hanging until the 5 s timeout. vmThreads keeps per-file module
        // isolation and still avoids the per-file environment cost.
        pool: 'vmThreads',
        css: false,
        restoreMocks: true,
        reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['default'],
    },
});