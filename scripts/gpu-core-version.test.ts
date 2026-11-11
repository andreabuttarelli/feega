import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { coreVersionOf } from './gpu-core-version.mjs';
import { CORE_VERSION } from '../packages/motion-core/src/motion/gpu-full/core-version';

describe('gpu-core version', () => {
  it('names the shipped wasm, so a rebuilt engine gets a new immutable URL', () => {
    expect(CORE_VERSION).toBe(coreVersionOf(readFileSync('static/gpu-core/gpu_core_bg.wasm'), readFileSync('static/gpu-core/gpu_core.js')));
  });
});
