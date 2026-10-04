import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../components';
import { Ease } from '../design';
import type { MotionClip } from '../doc';
import { ModifierKind } from '../shape/modifiers';
import { shapeBake, shapeHtml, shapeScript } from './shapes';

const clip = (props: Record<string, unknown>, keyframes: MotionClip['keyframes'] = {}): MotionClip =>
  ({ id: 's1', component: 'Shape', from: 10, durationInFrames: 4, props: COMPONENTS.Shape.schema.parse({ shape: 'rect', ...props }), keyframes, transform: {} }) as unknown as MotionClip;
const env = { width: 1000, height: 1000, unit: 1000, fps: 30, color: (v: string) => v };

describe('shape bake', () => {
  it('a still shape needs no per-frame table', () => {
    expect(shapeBake(clip({}), env)).toBeNull();
  });

  it('keyed geometry bakes one entry per frame, identical frames shared', () => {
    const keyed = clip({ shape: 'star' }, { innerRadius: [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 2, value: 0.8, ease: Ease.Linear }] });
    const bake = shapeBake(keyed, env)!;
    expect(bake.from).toBe(10);
    expect(bake.index).toEqual([0, 1, 2, 2]);
    expect(bake.frames).toHaveLength(3);
  });

  it('a keyed modifier param bakes too, so trim paths draws on', () => {
    const drawn = clip({ modifiers: [{ id: 't', kind: ModifierKind.Trim, params: {} }] }, { 'mod.t.end': [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 3, value: 1, ease: Ease.Linear }] });
    const bake = shapeBake(drawn, env)!;
    expect(bake.frames[bake.index[0]]).not.toContain('<path');
    expect(bake.frames[bake.index[3]]).toContain('Z"');
  });

  it('a wiggle with speed animates without keyframes, and bakes the same twice', () => {
    const wiggly = clip({ modifiers: [{ id: 'w', kind: ModifierKind.Wiggle, params: { speed: 5 } }] });
    expect(shapeBake(wiggly, env)).toEqual(shapeBake(wiggly, env));
    expect(shapeBake(wiggly, env)!.frames.length).toBeGreaterThan(1);
  });

  it('the html holds the first frame inside an svg the runtime can find', () => {
    const html = shapeHtml('s1', clip({}).props as never, env, { w: 100, h: 50 });
    expect(html).toMatch(/^<svg id="sv-s1" width="100" height="50" viewBox="0 0 100 50"/);
  });

  it('the runtime swaps frames on seek and is empty when nothing moves', () => {
    expect(shapeScript([], 30, 4)).toBe('');
    const script = shapeScript([{ id: 's1', from: 10, index: [0], frames: ['<path/>'] }], 30, 4);
    expect(script).toContain("addEventListener('hf-seek'");
    expect(script).toContain('sv-');
  });
});
