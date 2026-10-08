import { describe, expect, it } from 'vitest';
import { LIVE_ENTRY, bundleSource } from './motion-bundles';
import { GENERATIVE_ENTRY } from '../src/lib/motion/custom/generative';
import { TWGL_ENTRY } from '../src/lib/motion/custom/twgl';
import { FX_ENTRY } from '../src/lib/motion/custom/fx';
import { SPLITTING_ENTRY } from '../src/lib/motion/custom/splitting';
import { OPEN_PROPS_ENTRY } from '../src/lib/motion/custom/open-props';

const MAX_RUNTIME_BYTES = 40 * 1024;
const MAX_GENERATIVE_BYTES = 200 * 1024;
const MAX_TWGL_BYTES = 120 * 1024;
const MAX_FX_BYTES = 8 * 1024;
const MAX_SPLITTING_BYTES = 8 * 1024;
const MAX_OPEN_PROPS_BYTES = 32 * 1024;

describe('live player runtime', () => {
  it('stays small: no doc model, schema library or parser bundle comes along', async () => {
    const { code, inputs } = await bundleSource(LIVE_ENTRY);

    expect(inputs.filter((f) => /node_modules\/(zod|acorn)/.test(f))).toEqual([]);
    expect(inputs.filter((f) => /motion\/(doc|keyframes|components)\.ts$/.test(f))).toEqual([]);
    expect(code.length).toBeLessThan(MAX_RUNTIME_BYTES);
  });

  it('keeps the generative utilities small enough to inline in every page that uses them', async () => {
    const { code } = await bundleSource(GENERATIVE_ENTRY);

    expect(code).toContain('__feegaGenerative');
    expect(code).toContain('Copyright Angus Johnson');
    expect(code.length).toBeLessThan(MAX_GENERATIVE_BYTES);
  });

  it('keeps fx a few kilobytes, with no keyframes or transitions', async () => {
    const { code } = await bundleSource(FX_ENTRY);

    expect(code).toContain('__feegaFx');
    expect(code).not.toMatch(/@keyframes|transition:|animation:/);
    expect(code.length).toBeLessThan(MAX_FX_BYTES);
  });

  it('keeps Splitting small, its MIT notice inside', async () => {
    const { code } = await bundleSource(SPLITTING_ENTRY);

    expect(code).toContain('Copyright (c) 2018 Stephen Shaw');
    expect(code.length).toBeLessThan(MAX_SPLITTING_BYTES);
  });

  it('keeps the Open Props subset small, its MIT notice inside', async () => {
    const { code } = await bundleSource(OPEN_PROPS_ENTRY);

    expect(code).toContain('Copyright (c) 2021 Adam Argyle');
    expect(code.length).toBeLessThan(MAX_OPEN_PROPS_BYTES);
  });

  it('keeps TWGL small enough to inline', async () => {
    const { code } = await bundleSource(TWGL_ENTRY);

    expect(code).toContain('createProgramInfo');
    expect(code).toContain('Copyright (c) 2015, Gregg Tavares');
    expect(code.length).toBeLessThan(MAX_TWGL_BYTES);
  });
});
