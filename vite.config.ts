import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const threeSourceEntry = fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      // Three publishes its source tree. Resolve only the bare package import to the
      // source entry so Rollup can tree-shake unused modules before creating the
      // deferred combat runtime chunk.
      { find: /^three$/, replacement: threeSourceEntry },
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
