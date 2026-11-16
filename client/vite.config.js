import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development, /api calls are proxied to the Express server.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 }, // the lazy-loaded 3D hall chunk contains three.js
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
