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
          // Keep Babylon's glTF plugin behind its existing dynamic import without
          // forcing Babylon core/post/WebGPU modules into mutually dependent manual chunks.
          if (normalizedId.includes('/node_modules/@babylonjs/loaders/')) return 'babylon-loaders';
          if (normalizedId.endsWith('/node_modules/three/build/three.core.js')) return 'three-core';
          if (normalizedId.endsWith('/node_modules/three/build/three.module.js')) return 'three-webgl';
          if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/')) return 'react-runtime';
        },
      },
    },
  },
});
