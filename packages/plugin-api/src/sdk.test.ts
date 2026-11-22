import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain script without types
import { SDK_FILE, sdkSource } from '../build-sdk.mjs';

const EXAMPLE = fileURLToPath(new URL('../../../examples/feega-plugin-hello/', import.meta.url));

describe('the plugin SDK', () => {
  it('the committed single-file build is current', async () => {
    expect(readFileSync(SDK_FILE, 'utf8')).toBe(await sdkSource());
  });

  it('exports what plugin authors use', async () => {
    expect(await sdkSource()).toMatch(/export \{[^}]*runPlugin/);
  });

  it('the example carries the current copy of it', async () => {
    expect(readFileSync(`${EXAMPLE}src/feega-plugin-sdk.js`, 'utf8')).toBe(await sdkSource());
  });

  it('the example plugin.js is its source bundled', async () => {
    const { outputFiles } = await build({ absWorkingDir: EXAMPLE, entryPoints: ['src/plugin.js'], bundle: true, format: 'iife', outfile: 'plugin.js', write: false });
    expect(readFileSync(`${EXAMPLE}plugin.js`, 'utf8')).toBe(outputFiles[0].text);
  });
});
