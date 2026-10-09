import { describe, expect, it } from 'vitest';
import { Ease } from '$lib/motion/design';
import { uiRing } from '$lib/motion/ui-ring';
import { PRESET } from '$lib/motion/device-presets';
import { BUILTIN_TEMPLATES } from './builtins';

const OVERSHOOT = `"ease":"${Ease.Overshoot}"`;

describe('built-in recipes land on the house curves', () => {
  it('no built-in template bounces', () => {
    const bouncing = BUILTIN_TEMPLATES.filter((e) => JSON.stringify(e.template).includes(OVERSHOOT)).map((e) => e.id);
    expect(bouncing).toEqual([]);
  });

  it('the UI ring does not bounce', () => {
    expect(JSON.stringify(uiRing())).not.toContain(OVERSHOOT);
  });

  it('no device preset bounces', () => {
    const bouncing = Object.entries(PRESET).filter(([, preset]) => JSON.stringify(preset.lanes(120)).includes(OVERSHOOT)).map(([name]) => name);
    expect(bouncing).toEqual([]);
  });
});
