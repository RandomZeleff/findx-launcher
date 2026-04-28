import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Évite deux copies de React (hooks invalides) quand des libs comme embla sont pré-bundlées. */
const reactAlias = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
} as const

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: reactAlias,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'embla-carousel-react'],
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              // webtorrent is ESM-only — keep it external so Electron loads it natively
              external: ['electron', 'webtorrent', '7zip-bin', 'jsdom', '@mozilla/readability', 'electron-updater'],
            },
          },
        },
      },
      {
        entry: 'electron/torrentWorker.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron', 'webtorrent', '7zip-bin', 'jsdom', '@mozilla/readability', 'electron-updater'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            // Avec "type": "module", vite-plugin-electron émet sinon du ESM ; le preload
            // doit être en CommonJS pour qu’Electron l’exécute correctement.
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
  ],
})
