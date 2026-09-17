import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const threeRuntimeFacade = fileURLToPath(new URL('./three-runtime.mjs', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      // Preserve the public Three.js API used by the game while routing production
      // runtime imports through the exact modules needed by combat rendering.
      { find: /^three$/, replacement: threeRuntimeFacade },
    ],
  },
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
