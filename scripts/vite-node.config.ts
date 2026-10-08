import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { motionBundles } from './motion-bundles';
const r = (p: string) => resolve(import.meta.dirname, p);
export default defineConfig({
  plugins: [motionBundles()],
  resolve: {
    alias: {
      '$app/environment': r('_shims/app-environment.ts'),
      '$app/server': r('_shims/app-server.ts'),
      '$env/dynamic/private': r('_shims/env-private.ts'),
      '$env/dynamic/public': r('_shims/env-public.ts'),
      '$env/static/public': r('_shims/env-static-public.ts'),
      '$lib': r('../src/lib')
    }
  }
});
