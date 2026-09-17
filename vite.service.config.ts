import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@netlify/blobs': resolve(process.cwd(), 'tests/mocks/netlify-blobs.ts'),
    },
  },
  ssr: {
    noExternal: ['@netlify/blobs'],
  },
});
