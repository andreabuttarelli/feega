import { realpathSync } from 'node:fs';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { ssrNoExternalForDeploy } from './scripts/ssr-no-external';
import { vercelAnalyticsDefine } from './scripts/vercel-analytics';
import { devCrons } from './scripts/dev-crons';
import { changelogEntries } from './scripts/changelog-entries';

const nodeModulesReal = (() => {
  try {
    return realpathSync('node_modules');
  } catch {
    return null;
  }
})();

const TEST_TIMEOUT_MS = 120_000;
const HOOK_TIMEOUT_MS = 30_000;

const AGENT_WORKTREES = '**/.claude/worktrees/**';
const OWN_DEPS_CACHE = '.vite-deps';

export default defineConfig({
  cacheDir: OWN_DEPS_CACHE,
  server: {
    fs: { allow: ['..', ...(nodeModulesReal ? [nodeModulesReal] : [])] },
    watch: { ignored: [AGENT_WORKTREES] }
  },
  optimizeDeps: { include: ['@sentry/sveltekit'] },
  define: vercelAnalyticsDefine(process.env),
  plugins: [
    sentrySvelteKit({
      org: '021-6z',
      project: '021-1m',
      autoInstrument: { load: false, serverLoad: true }
    }),
    sveltekit(),
    tailwindcss(),
    devCrons(),
    changelogEntries()
  ],
  build: {
    target: ['es2022', 'chrome111', 'firefox115', 'safari16.4', 'edge111'],
    sourcemap: false,
    reportCompressedSize: false
  },
  ssr: {
    noExternal: ssrNoExternalForDeploy(process.env.DEPLOY_TARGET ?? '')
  },
  test: {
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: HOOK_TIMEOUT_MS,
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'packages/*/src/**/*.{test,spec}.{js,ts}',
      'packages/*.{test,spec}.{js,ts}',
      'npx/src/**/*.test.ts',
      'scripts/**/*.{test,spec}.{js,ts}',
      'cli/**/*.{test,spec}.{js,ts}',
      'inspect/src/**/*.test.ts'
    ],
    alias: { 'bun:test': 'vitest' },
    setupFiles: ['src/test/no-live-supabase.ts']
  }
});
