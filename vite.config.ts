import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// OASA doesn't send CORS headers on most endpoints, so /oasa/* is proxied to it
const oasaProxy = {
  '/oasa': {
    target: 'https://telematics.oasa.gr',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/oasa/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: oasaProxy },
  preview: { proxy: oasaProxy },
})
