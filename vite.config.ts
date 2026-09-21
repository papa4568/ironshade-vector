import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    manifest: true,
    chunkSizeWarningLimit: Infinity,
    rollupOptions: {
      maxParallelFileOps: 128,
      output: {
        manualChunks(id) {
          if (id.endsWith('/node_modules/three/build/three.core.js')) return 'three-core';
          if (id.endsWith('/node_modules/three/build/three.module.js')) return 'three-webgl';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-runtime';
        },
      },
    },
  },
});
