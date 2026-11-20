import { readFileSync } from 'node:fs';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12);
const releaseName = `${pkg.version}+${commit || 'dev'}`;
const VERSION_POLL_MS = 60_000;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: vercelAdapter({ runtime: 'nodejs22.x', maxDuration: 300, regions: ['lhr1'] }),

    version: { name: releaseName, pollInterval: VERSION_POLL_MS },

    csrf: { checkOrigin: false },

    experimental: {
      tracing: {
        server: true
      },

      instrumentation: {
        server: true
      }
    }
  }
};

export default config;
