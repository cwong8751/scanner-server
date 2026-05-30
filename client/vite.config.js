import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/qr': 'http://localhost:3232',
      '/restart': 'http://localhost:3232',
      '/events': 'http://localhost:3232',
    },
  },
});
