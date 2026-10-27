import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: vercelAdapter({ runtime: 'nodejs22.x' }),
    prerender: { handleHttpError: 'warn' },
    inlineStyleThreshold: 50000
  }
};
