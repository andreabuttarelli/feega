import { describe, expect, it } from 'vitest';
import { softwareAdapter } from './bench-stats.mjs';

describe('bench adapter', () => {
  it('a SwiftShader adapter is software rendering, not the app on a GPU', () => {
    expect(softwareAdapter({ vendor: 'google', architecture: 'swiftshader', description: 'SwiftShader Device (Subzero)' })).toBe(true);
  });

  it('a real GPU or an unknown adapter counts as measured', () => {
    expect(softwareAdapter({ vendor: 'apple', architecture: 'metal-3', description: '' })).toBe(false);
    expect(softwareAdapter(null)).toBe(false);
  });
});
