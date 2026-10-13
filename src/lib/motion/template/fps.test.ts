import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { setFrameRate } from '$lib/motion/frame-rate';
import type { OpResult } from '$lib/motion/timeline';
import { insertTemplate, type Inserted } from './library';
import { starterDoc } from './catalogue';
import { builtinTemplate } from './builtins';

const ids = () => {
  let n = 0;
  return () => `f${++n}`;
};

function must(r: OpResult | Inserted): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const at60 = () => must(setFrameRate(newMotionDoc(MotionFormat.Landscape), 60));
const allClips = (doc: MotionDoc) => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);
const hostOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;

describe('a 30 fps template in a 60 fps video', () => {
  const badge = builtinTemplate('builtin:introducing-badge')!;
  const seconds = badge.template.doc.durationInFrames / badge.template.doc.fps;

  it('lasts the same seconds, inside and out', () => {
    const doc = must(insertTemplate(at60(), badge, { from: 0, newId: ids() }));
    const compId = String(hostOf(doc).props.comp);

    expect(badge.template.doc.fps).toBe(30);
    expect(hostOf(doc).durationInFrames / doc.fps).toBe(seconds);
    expect(doc.comps[compId].durationInFrames / doc.fps).toBe(seconds);
    doc.comps[compId].tracks.flatMap((t) => t.clips).forEach((c) => expect(c.durationInFrames / doc.fps).toBe(seconds));
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('keeps every keyframe at the same template time', () => {
    const entry = builtinTemplate('builtin:launch-word-burst')!;
    const source = allClips(entry.template.doc).find((c) => Object.keys(c.keyframes).length)!;
    const [prop, track] = Object.entries(source.keyframes)[0];
    const moved = allClips(must(insertTemplate(at60(), entry, { from: 0, newId: ids() }))).find((c) => c.id.endsWith(`-${source.id}`))!;

    expect(moved.keyframes[prop].map((k) => k.frame / 60)).toEqual(track.map((k) => k.frame / entry.template.doc.fps));
  });

  it('turns a started-from-template video to 60 fps without halving the template', () => {
    const doc = must(setFrameRate(must(starterDoc(badge, MotionFormat.Landscape, ids())), 60));

    expect(doc.comps[String(hostOf(doc).props.comp)].durationInFrames / doc.fps).toBe(seconds);
  });
});
