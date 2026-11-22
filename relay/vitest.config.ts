import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export const TEST_SECRET = 'relay-test-secret';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: { RELAY_SIGNING_SECRET: TEST_SECRET, VISITOR_BASE: 'localhost:8787', WEB_ORIGIN: 'http://web.test' }
      }
    })
  ],
  test: { include: ['test/**/*.test.ts'], testTimeout: 15000 }
});
