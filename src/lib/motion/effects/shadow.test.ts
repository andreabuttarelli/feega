import { describe, expect, it } from 'vitest';
import { EFFECTS, EffectKind, defaultValues, type SvgNode } from './registry';

const FRAME = { width: 100, height: 100, frame: 0, fps: 30 };
const drop = (extra: Record<string, number | string>) => EFFECTS[EffectKind.DropShadow].render({ ...defaultValues(EffectKind.DropShadow), ...extra }, FRAME, 'f', null);
const tags = (nodes: SvgNode[]): SvgNode[] => nodes.flatMap((n) => [n, ...tags(n.children ?? [])]);

describe('drop shadow like figma', () => {
  it('the defaults keep the plain css drop shadow', () => {
    expect(drop({}).filter).toMatch(/^drop-shadow/);
  });

  it('x and y move the shadow on top of distance and angle', () => {
    expect(drop({ distance: 0, x: 5, y: -3 }).filter).toBe('drop-shadow(5px -3px 24px rgba(0,0,0,0.5))');
  });

  it('a positive spread grows the shadow with a dilate', () => {
    const morph = tags(drop({ spread: 6 }).nodes).find((n) => n.tag === 'feMorphology');
    expect(morph?.attrs).toMatchObject({ operator: 'dilate', radius: 6 });
  });

  it('a negative spread shrinks it with an erode', () => {
    const morph = tags(drop({ spread: -4 }).nodes).find((n) => n.tag === 'feMorphology');
    expect(morph?.attrs).toMatchObject({ operator: 'erode', radius: 4 });
  });

  it('hiding the shadow behind cuts it out under the whole shape, even a see-through one', () => {
    const nodes = tags(drop({ behind: 0 }).nodes);
    const cut = nodes.find((n) => n.tag === 'feComposite' && n.attrs.operator === 'out');
    const solid = nodes.find((n) => n.attrs.result === cut?.attrs.in2);
    expect(solid?.attrs).toMatchObject({ in: 'SourceAlpha', type: 'matrix' });
  });

  it('the boxed render carries spread too', () => {
    const boxed = EFFECTS[EffectKind.DropShadow].boxed!({ ...defaultValues(EffectKind.DropShadow), spread: 2 }, 'f');
    expect(tags(boxed.nodes).some((n) => n.tag === 'feMorphology')).toBe(true);
  });
});
