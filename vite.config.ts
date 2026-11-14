import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://api.sakinatherapy.app'
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(target).hostname)
  // A remote backend is selected by virtual host, so it needs its own Host header.
  const proxy = { '/api': { target, changeOrigin: !local } }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      include: ['tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  }
})
