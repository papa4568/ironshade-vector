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
          if (
            normalizedId.includes('/node_modules/@babylonjs/core/Engines/webgpuEngine')
            || normalizedId.includes('/node_modules/@babylonjs/core/Engines/WebGPU/')
          ) return 'babylon-webgpu';
          if (
            normalizedId.includes('/node_modules/@babylonjs/core/Layers/')
            || normalizedId.includes('/node_modules/@babylonjs/core/PostProcesses/')
          ) return 'babylon-post';
          if (normalizedId.includes('/node_modules/@babylonjs/loaders/')) return 'babylon-loaders';
          if (normalizedId.includes('/node_modules/@babylonjs/core/')) return 'babylon-core';
          if (normalizedId.endsWith('/node_modules/three/build/three.core.js')) return 'three-core';
          if (normalizedId.endsWith('/node_modules/three/build/three.module.js')) return 'three-webgl';
          if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/')) return 'react-runtime';
        },
      },
    },
  },
});
