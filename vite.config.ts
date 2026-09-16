import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    manifest: true,
    rollupOptions: {
      maxParallelFileOps: 128,
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-runtime';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-runtime';
        },
      },
    },
  },
});
