import { describe, expect, it } from 'vitest';
import { LIVE_ENTRY, bundleSource } from './motion-bundles';

const MAX_RUNTIME_BYTES = 40 * 1024;

describe('live player runtime', () => {
  it('stays small: no doc model, schema library or parser bundle comes along', async () => {
    const { code, inputs } = await bundleSource(LIVE_ENTRY);

    expect(inputs.filter((f) => /node_modules\/(zod|acorn)/.test(f))).toEqual([]);
    expect(inputs.filter((f) => /motion\/(doc|keyframes|components)\.ts$/.test(f))).toEqual([]);
    expect(code.length).toBeLessThan(MAX_RUNTIME_BYTES);
  });
});
