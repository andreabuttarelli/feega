import { describe, expect, it, vi } from 'vitest';
import { applyStack } from './index';
import { customPass, customParams, addCustomStep, CustomStatus, statusOf, type CustomEffect, type ShaderDrawer } from './custom';
import { stepLabel, stepParams } from './editor';
import { makePixels } from './test-helpers';
import type { EffectStep, Pixels } from './types';

const grey = () => makePixels(2, 2, () => [100, 100, 100, 255]);

const effect = (over: Partial<CustomEffect> = {}): CustomEffect => ({
  id: 'fx-1',
  name: 'vhs',
  version: 1,
  frag: 'vec4 effect(vec2 uv) { return texture2D(u_src, uv) * u_amount; }',
  params: [{ key: 'amount', label: 'Amount', kind: 'number', min: 0, max: 2, step: 0.1, default: 1 }],
  check: { state: 'passed', problems: [], costMs: 1 },
  ...over
});

const step: EffectStep = { id: 'custom', ref: 'fx-1', params: { amount: 0.5 }, enabled: true };

const inverting: ShaderDrawer = vi.fn((_fx, pixels: Pixels) => ({
  pixels: { ...pixels, data: pixels.data.map((v, i) => (i % 4 === 3 ? v : 255 - v)) },
  compiled: true
}));

describe('custom steps in applyStack', () => {
  it('applyStack with a custom step changes pixels through the custom pass', () => {
    const out = applyStack(grey(), [step], customPass([effect()], inverting));

    expect(out.data[0]).toBe(155);
    expect(inverting).toHaveBeenCalledWith(expect.objectContaining({ id: 'fx-1' }), expect.anything(), { amount: 0.5 });
  });

  it('without a custom pass a custom step leaves the pixels unchanged', () => {
    expect(applyStack(grey(), [step]).data[0]).toBe(100);
  });

  it('a failed effect leaves the pixels unchanged and never reaches the GPU', () => {
    const drawer = vi.fn(inverting);

    const out = applyStack(grey(), [step], customPass([effect({ check: { state: 'failed', problems: ['x'], costMs: null } })], drawer));

    expect(out.data[0]).toBe(100);
    expect(drawer).not.toHaveBeenCalled();
  });

  it('a step whose effect is gone leaves the pixels unchanged', () => {
    expect(applyStack(grey(), [step], customPass([], inverting)).data[0]).toBe(100);
  });
});

describe('custom effect status', () => {
  it.each([
    [[effect()], CustomStatus.Ready],
    [[effect({ check: { state: 'failed', problems: [], costMs: null } })], CustomStatus.Failed],
    [[], CustomStatus.Missing]
  ])('marks the step', (effects, status) => {
    expect(statusOf(effects, 'fx-1')).toBe(status);
  });
});

describe('custom params adapt to the canvas controls', () => {
  it('maps number to range and keeps colour and seed', () => {
    const params = customParams(
      effect({
        params: [
          { key: 'amount', label: 'Amount', kind: 'number', min: 0, max: 2, step: 0.1, default: 1 },
          { key: 'tint', label: 'Tint', kind: 'color', default: '#ff0000' },
          { key: 'grain', label: 'Grain', kind: 'seed', default: 3 }
        ]
      })
    );

    expect(params).toEqual([
      { name: 'amount', label: 'Amount', kind: 'range', min: 0, max: 2, step: 0.1, default: 1 },
      { name: 'tint', label: 'Tint', kind: 'color', default: '#ff0000' },
      { name: 'grain', label: 'Grain', kind: 'seed', default: 3 }
    ]);
  });

  it('adds a custom step with the defaults', () => {
    expect(addCustomStep([], effect())).toEqual([{ id: 'custom', ref: 'fx-1', params: { amount: 1 }, enabled: true }]);
  });
});

describe('step label and params', () => {
  it('reads a custom step from its effect and a builtin from the table', () => {
    expect(stepLabel(step, [effect()])).toBe('vhs');
    expect(stepLabel(step, [])).toBe('Missing effect');
    expect(stepParams(step, [effect()]).map((p) => p.name)).toEqual(['amount']);
    expect(stepLabel({ id: 'noise', params: {}, enabled: true }, [])).toBe('Rumore');
  });
});
