/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite preview` serves the same headers as production (vercel.json), so the
// e2e suite runs under the real Content-Security-Policy and fails on any
// violation instead of finding it after a deploy.
const vercel = JSON.parse(
  readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'),
)
const siteHeaders = Object.fromEntries(
  (vercel.headers.find((rule) => rule.source === '/(.*)')?.headers ?? []).map(
    (header) => [header.key, header.value],
  ),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: siteHeaders },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    restoreMocks: true,
    // Parallel worker start-up times out on Windows; two workers keep the suite reliable.
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/main.jsx'],
    },
  },
})
