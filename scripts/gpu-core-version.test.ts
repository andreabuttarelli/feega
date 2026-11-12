import { describe, expect, it } from 'vitest';
import { BUILDS, builtVersion } from './gpu-core-version.mjs';
import * as versions from '../packages/motion-core/src/motion/gpu-full/core-version';

describe('gpu-core version', () => {
  it.each(Object.entries(BUILDS))('%s names the shipped %s, so a rebuilt engine gets a new immutable URL', (constant, name) => {
    expect((versions as Record<string, string>)[constant]).toBe(builtVersion(name));
  });
});
