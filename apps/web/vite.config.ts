import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      // The API binds to 127.0.0.1. Using the same address avoids a
      // localhost IPv6/IPv4 resolution mismatch in development mode.
      '/api': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
