import { describe, expect, it } from 'vitest';
import { CheckState } from '$lib/server/repos/effects';
import { CHECK_BUDGET_MS, verdictOf, checkEffect, type GlPage } from './check';

describe('verdictOf', () => {
  it.each([
    ['passes a cheap steady effect', { problems: [], costMs: 3, flicker: 0.01 }, CheckState.Passed, []],
    ['fails a compile problem', { problems: ['ERROR: nope'], costMs: null, flicker: null }, CheckState.Failed, ['ERROR: nope']],
    ['fails over budget, with the reason', { problems: [], costMs: CHECK_BUDGET_MS + 1, flicker: 0 }, CheckState.Failed, [expect.stringMatching(/budget/)]],
    ['passes a strobe with a warning, never a block', { problems: [], costMs: 3, flicker: 0.6 }, CheckState.Passed, [expect.stringMatching(/^warning: .*flicker/)]]
  ])('%s', (_, measured, state, problems) => {
    expect(verdictOf(measured)).toEqual({ state, problems, costMs: measured.costMs });
  });
});

describe('checkEffect', () => {
  it('measures in the GL page and returns the verdict', async () => {
    const scripts: string[] = [];
    const gl: GlPage = { run: async <T,>(script: string) => (scripts.push(script), { problems: [], costMs: 2, flicker: 0 } as T) };

    const check = await checkEffect(gl, { frag: 'vec4 effect(vec2 uv) { return vec4(1.0); }', params: [] });

    expect(check.state).toBe(CheckState.Passed);
    expect(scripts[0]).toContain('__shaderFx.measure');
  });

  it('a page that crashes leaves the effect unchecked', async () => {
    const gl: GlPage = { run: async () => Promise.reject(new Error('crashed')) };

    expect((await checkEffect(gl, { frag: 'x', params: [] })).state).toBe(CheckState.Unchecked);
  });
});
