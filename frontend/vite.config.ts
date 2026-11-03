import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // VITE_* values are fixed at build time, so a forgotten one cannot be fixed later.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd())
    for (const name of ['VITE_API_URL', 'VITE_DESMOS_API_KEY']) {
      if (!env[name]?.trim()) console.warn(`[image2desmos] ${name} is not set for this build.`)
    }
  }

  return {
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  }
})
