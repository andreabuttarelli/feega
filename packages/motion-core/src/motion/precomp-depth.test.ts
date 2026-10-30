import { describe, expect, it } from 'vitest';
import { newClip, type MotionDoc } from './doc';
import { flattenComps } from './precomp';
import { TrackKind } from './components';

const LEVELS = 12;

function nested(levels: number): MotionDoc {
  const leaf = newClip({ id: 'leaf', from: 0, durationInFrames: 30, component: 'Title', props: { text: 'deep' } });
  const comps = Object.fromEntries(
    Array.from({ length: levels }, (_, i) => {
      const inner = i === levels - 1 ? leaf : newClip({ id: `h${i + 1}`, from: 0, durationInFrames: 30, component: 'Precomp', props: { comp: `c${i + 1}` } });
      return [`c${i}`, { name: `c${i}`, durationInFrames: 30, tracks: [{ id: 't', kind: TrackKind.Visual, name: '', clips: [inner] }] }];
    })
  );
  const host = newClip({ id: 'h0', from: 0, durationInFrames: 30, component: 'Precomp', props: { comp: 'c0' } });
  return { width: 400, height: 300, fps: 30, durationInFrames: 30, tracks: [{ id: 'v', kind: TrackKind.Visual, name: '', clips: [host] }], comps } as unknown as MotionDoc;
}

describe('flattenComps', () => {
  it('una pagina importata con dodici livelli di componenti arriva fino al testo più interno', () => {
    const flat = flattenComps(nested(LEVELS));

    expect(JSON.stringify(flat.tracks)).toContain('"text":"deep"');
  });

  it('a group sharing a track with plain clips stays between the clip before it and the clip after it', () => {
    const plain = (id: string) => newClip({ id, from: 0, durationInFrames: 30, component: 'Title', props: { text: id } });
    const inner = { name: 'g', durationInFrames: 30, tracks: [{ id: 't', kind: TrackKind.Visual, name: '', clips: [plain('inside')] }] };
    const group = newClip({ id: 'group', from: 0, durationInFrames: 30, component: 'Precomp', props: { comp: 'g' } });
    const doc = { width: 400, height: 300, fps: 30, durationInFrames: 30, tracks: [{ id: 'v', kind: TrackKind.Visual, name: '', clips: [plain('below'), group, plain('above')] }], comps: { g: inner } } as unknown as MotionDoc;

    const topFirst = flattenComps(doc).tracks.flatMap((t) => [...t.clips].reverse().map((c) => String(c.props.text ?? c.id)));

    expect(topFirst.filter((t) => ['below', 'inside', 'above'].includes(t))).toEqual(['above', 'inside', 'below']);
  });
});
