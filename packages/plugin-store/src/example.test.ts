import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Origin } from '@feega/plugin-api/external';
import { catalogOf } from './catalog';

const HELLO = fileURLToPath(new URL('../../../examples/feega-plugin-hello', import.meta.url));

describe('the example plugin', () => {
  it('loads as a dev plugin from its folder', async () => {
    const out = await catalogOf({ root: mkdtempSync(join(tmpdir(), 'feega-example-')), dev: [HELLO] });
    expect(out.problems).toEqual([]);
    expect(out.plugins).toMatchObject([{ id: 'example.hello', origin: Origin.Dev, enabled: true, words: ['See which element you select'] }]);
    expect(out.plugins[0].code).toContain('feega-plugin-sdk');
  });
});
