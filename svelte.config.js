import { readFileSync } from 'node:fs';
import vercelAdapter from '@sveltejs/adapter-vercel';
import nodeAdapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const NODE_DEPLOY_TARGET = 'node';
const deployTarget = process.env.DEPLOY_TARGET ?? '';
const nativeBundle = process.env.FEEGA_TARGET === 'bundle';
const NATIVE_OUT = 'apps/native/bundle-dist';
const NATIVE_SRC = '.native';
const NATIVE_FILES = {
  src: NATIVE_SRC,
  routes: `${NATIVE_SRC}/routes`,
  lib: 'src/lib',
  params: 'src/params',
  assets: 'static',
  appTemplate: 'src/app.html',
  hooks: { client: 'src/hooks.client', server: `${NATIVE_SRC}/hooks.server`, universal: `${NATIVE_SRC}/hooks` },
  serviceWorker: `${NATIVE_SRC}/service-worker`
};

function adapterFor() {
  if (nativeBundle) {
    return staticAdapter({ pages: NATIVE_OUT, assets: NATIVE_OUT, fallback: 'index.html', strict: false });
  }
  if (deployTarget === NODE_DEPLOY_TARGET) {
    return nodeAdapter();
  }
  return vercelAdapter({ runtime: 'nodejs22.x', maxDuration: 300, regions: ['lhr1'] });
}

// Release tag: `<semver>+<commit>` (see src/lib/release.ts for the full rationale).
// The semver half is bumped by a person via `npm run release`; the commit half is automatic.
// Kit exposes this as `version` from `$app/environment` and uses it to notice new deployments.
// Its default is `Date.now()`, which changes even when the code did not — keying on the commit
// means redeploying the same commit no longer looks like a new version to connected clients.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12);
const releaseName = `${pkg.version}+${commit || 'dev'}`;
const VERSION_POLL_MS = 60_000;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapterFor(),

    alias: { $web: 'src/routes' },

    ...(nativeBundle ? { files: NATIVE_FILES } : {}),

    version: { name: releaseName, pollInterval: VERSION_POLL_MS },

    // Kit's built-in check is all-or-nothing and rejects any form-encoded POST without an
    // `origin` header — which is exactly what an OAuth token request from a CLI looks like.
    // Re-implemented in hooks.server.ts so /oauth/token can be exempted and everything else
    // keeps the same protection. Do not flip this back on without reading that hook.
    //
    // ponytail: kit deprecates `checkOrigin` in favour of `trustedOrigins`, which does NOT
    // cover this case — a *missing* origin is rejected whatever is on the trusted list
    // (runtime/server/respond.js: `!request_origin || !trusted.includes(...)`). Expect the
    // build to warn. When kit removes the flag, /oauth/token has to move off SvelteKit's
    // request path (own Vercel function) or kit has to grow per-route opt-out.
    csrf: { checkOrigin: false },

    experimental: nativeBundle
      ? {}
      : {
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