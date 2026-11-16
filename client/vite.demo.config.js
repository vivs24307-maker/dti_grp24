import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the standalone 3D seat-picker demo (demo.html). `npm run build:demo` then inlines
// the JS and CSS so the result is one HTML file you can open or host anywhere.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: 'demo.html' },
  },
});
