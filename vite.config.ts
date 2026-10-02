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
          const normalizedId = id.replaceAll('\\', '/');
          // Babylon uses real dynamic import boundaries for the renderer, glTF loader,
          // and optional WebGPU engine. Do not manually merge Babylon modules across them.
          if (normalizedId.includes('/node_modules/@babylonjs/')) return undefined;
          if (normalizedId.endsWith('/node_modules/three/build/three.core.js')) return 'three-core';
          if (normalizedId.endsWith('/node_modules/three/build/three.module.js')) return 'three-webgl';
          if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/')) return 'react-runtime';
        },
      },
    },
  },
});
