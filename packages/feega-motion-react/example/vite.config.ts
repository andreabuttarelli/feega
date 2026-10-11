import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@feega/motion-react': new URL('../src/index.ts', import.meta.url).pathname } }
});
