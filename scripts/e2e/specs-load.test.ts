import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const LIST_TIMEOUT_MS = 180_000;

describe('the e2e suite', () => {
  it(
    'every spec loads under Node, so one bad import never empties the whole run',
    () => {
      const listed = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--list'], {
        encoding: 'utf8',
        env: { ...process.env, E2E_REAL_STACK: '1', E2E_BASE_URL: 'http://localhost:1', CI: '' },
        timeout: LIST_TIMEOUT_MS
      });
      const output = `${listed.stdout}${listed.stderr}`;

      expect(output).not.toMatch(/Error/);
      expect(listed.status).toBe(0);
    },
    LIST_TIMEOUT_MS
  );
});
