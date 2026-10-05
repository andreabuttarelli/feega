import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setCanvas, setTransform, type OpResult } from '../timeline';
import { composeHtml } from './compose';
import { HOT_PATCH, hotPatch } from './hot';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hi' } }, 't'));
const html = (d: MotionDoc) => composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets: {} });

describe('hot patching the preview', () => {
  it('cambiare l’opacità non ricompone: the change travels as a patch of #root and the timeline', () => {
    const next = must(setTransform(base, 't', { opacity: 0.3 }));
    const patch = hotPatch(html(base), html(next));

    expect(patch?.type).toBe(HOT_PATCH);
    expect(patch?.root).toContain('data-clip="t"');
    expect(patch?.scripts.join('')).toContain('0.3');
  });

  it('changing the text patches too', () => {
    const next = must(addClip(base, { component: 'Title', from: 10, durationInFrames: 20, props: { text: 'Two' } }, 'u'));

    expect(hotPatch(html(base), html(next))?.root).toContain('Two');
  });

  it('a change outside #root and the timeline reloads: the length', () => {
    const longer = must(setCanvas(base, { durationInFrames: 90 }));

    expect(hotPatch(html(base), html(longer))).toBeNull();
  });

  it('a composition with a 3D scene reloads', () => {
    const shaped = must(addClip(base, { component: 'Shape3D', from: 0, durationInFrames: 30 }, 's'));
    const moved = must(setTransform(shaped, 's', { opacity: 0.5 }));

    expect(hotPatch(html(shaped), html(moved))).toBeNull();
  });

  it('the same document needs nothing', () => {
    expect(hotPatch(html(base), html(base))).toBeNull();
  });
});
