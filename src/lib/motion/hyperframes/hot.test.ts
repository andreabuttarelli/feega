import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, setCanvas, setTrackMatte, setTransform, type OpResult } from '../timeline';
import { TrackKind } from '../components';
import { Matte } from '../mask';
import { MATTE_RUNTIME } from './mattes';
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
const patchScripts = (page: string) => [...page.matchAll(/<script data-hot>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

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

  describe('a clip with a track matte', () => {
    const stacked = must(addClip(must(addTrack(base, TrackKind.Visual, 'top')), { component: 'Title', from: 0, durationInFrames: 60, trackId: 'top', props: { text: 'GO' } }, 'src'));
    const matted = must(setTrackMatte(stacked, 't', Matte.Alpha));

    it('patches, and the patch restarts the matte runtime', () => {
      const patch = hotPatch(html(matted), html(must(setTransform(matted, 'src', { opacity: 0.5 }))));

      expect(patch?.scripts.some((s) => s.includes(MATTE_RUNTIME))).toBe(true);
    });

    it('a restarted matte runtime replaces the old one instead of piling up', () => {
      const script = patchScripts(html(matted)).find((s) => s.includes(MATTE_RUNTIME))!;
      const listeners: string[] = [];
      const tweens: unknown[] = [];
      const timeline = { to: (...args: unknown[]) => tweens.push(args), clear: () => tweens.splice(0) };
      const win: Record<string, unknown> = { __timelines: { main: timeline }, htmlToImage: {} };
      const run = () =>
        new Function('window', 'document', 'addEventListener', 'removeEventListener', script)(
          win,
          { getElementById: () => null, querySelector: () => null },
          (type: string) => listeners.push(type),
          (type: string) => listeners.splice(listeners.indexOf(type), 1)
        );

      run();
      timeline.clear();
      run();

      expect(listeners).toEqual(['hf-seek']);
      expect(tweens).toHaveLength(1);
    });
  });

  it('the same document needs nothing', () => {
    expect(hotPatch(html(base), html(base))).toBeNull();
  });
});
