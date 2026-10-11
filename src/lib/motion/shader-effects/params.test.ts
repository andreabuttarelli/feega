import { describe, expect, it } from 'vitest';
import { shaderEffectProps } from './params';

describe('shader effect keyframes', () => {
  it('every knob but speed takes keyframes', () => {
    const keys = shaderEffectProps({ component: 'ShaderEffect', props: { effect: 'plasma' } }).map((p) => p.key);

    expect(keys).toEqual(['density', 'intensity', 'warp', 'colorA', 'colorB']);
  });

  it('other components have none', () => {
    expect(shaderEffectProps({ component: 'Title', props: {} })).toEqual([]);
  });
});
