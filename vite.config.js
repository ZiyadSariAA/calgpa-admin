import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/glide-api': {
        target: 'https://gdps-ksa.glide.page',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glide-api/, ''),
      },
      '/glide-data': {
        target: 'https://storage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/glide-data/, ''),
      },
    },
  },
})
