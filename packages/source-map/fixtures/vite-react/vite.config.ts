import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { feegaSource } from '../../src/vite.ts';

export default defineConfig({
  plugins: [feegaSource(), react()]
});
