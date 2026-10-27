import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { clipFieldGroups } from '../inspector';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const keysFor = (shape: string) => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, props: { shape } }, 's'));
  return clipFieldGroups(doc, findClip(doc, 's')!.clip).flatMap((g) => g.fields.map((f) => f.key));
};

describe('the inspector shows only the geometry a shape kind uses', () => {
  it('a star shows points and inner radius, not sides; a polygon the opposite; an ellipse none', () => {
    expect(keysFor('star')).toEqual(expect.arrayContaining(['points', 'innerRadius', 'roundness']));
    expect(keysFor('star')).not.toContain('sides');
    expect(keysFor('polygon')).toContain('sides');
    expect(keysFor('polygon')).not.toContain('points');
    expect(keysFor('ellipse')).not.toContain('roundness');
    expect(keysFor('ellipse')).toContain('fills');
  });

  it('the fill stack replaces the single-colour fill fields', () => {
    expect(keysFor('rect')).toContain('fills');
    expect(keysFor('rect')).not.toEqual(expect.arrayContaining(['fillKind']));
    for (const legacy of ['fillKind', 'fill', 'fill2', 'gradientAngle']) {
      expect(keysFor('ellipse')).not.toContain(legacy);
    }
  });

  it('an ellipse shows its arc, a rectangle does not', () => {
    expect(keysFor('ellipse')).toEqual(expect.arrayContaining(['arcStart', 'arcSweep', 'arcRatio']));
    expect(keysFor('rect')).not.toContain('arcSweep');
  });

  it('a rectangle has a field per corner, a star does not', () => {
    expect(keysFor('rect')).toContain('corners');
    expect(keysFor('star')).not.toContain('corners');
  });
});
