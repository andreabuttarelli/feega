import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { Side, addClip, setTransition } from './timeline';
import { Quality, docProblems, frameProblems } from './direction';
import { Ease, TransitionKind } from './design';
import { builtinTemplate } from './template/builtins';
import { insertTemplate } from './template/library';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SCENE = 90;

function scene(doc: MotionDoc, i: number, look: { titleX: number; media: 'Image' | 'Device3D'; mediaX: number; titleBox?: { width: number; height: number } }): MotionDoc {
  const box = look.titleBox ?? { width: 0.4, height: 0.24 };
  const titled = must(addClip(doc, { component: 'Title', from: i * SCENE, durationInFrames: SCENE, props: { text: `Beat ${i}`, x: look.titleX, ...box } }, `t${i}`));
  const placed = must(addClip(titled, { component: look.media, from: i * SCENE, durationInFrames: SCENE, props: { x: look.mediaX } }, `m${i}`));
  const drift = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: SCENE, value: 1.05, ease: Ease.Linear }] };
  return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === `m${i}` ? { ...c, keyframes: drift } : c)) })) };
}

function dubLike(): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  for (let i = 0; i < 4; i++) {
    doc = scene(doc, i, { titleX: 0.25, media: i % 2 ? 'Image' : 'Device3D', mediaX: 0.7 });
  }
  return doc;
}

const kinds = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).map((p) => p.kind);

describe('the quality gate reads the direction of the video', () => {
  it('the Dub run: one layout four times and small titles are named', () => {
    expect(kinds(dubLike())).toEqual(expect.arrayContaining([Quality.RepeatedLayout, Quality.SmallTitle]));
  });

  it('scenes that alternate their layout, enter with a transition and carry a big title pass', () => {
    let doc = newMotionDoc(MotionFormat.Landscape);
    const looks = [
      { titleX: 0.5, media: 'Image' as const, mediaX: 0.5 },
      { titleX: 0.25, media: 'Device3D' as const, mediaX: 0.7 },
      { titleX: 0.75, media: 'Image' as const, mediaX: 0.3 }
    ];
    looks.forEach((look, i) => {
      doc = scene(doc, i, { ...look, titleBox: { width: 0.8, height: 0.3 } });
      doc = must(setTransition(doc, `t${i}`, Side.In, { kind: TransitionKind.Fade, durationInFrames: 12 }));
    });

    expect(kinds(doc)).toEqual([]);
  });

  it('scenes from the library are told apart by their template: two different scenes pass, the same one twice repeats', () => {
    let n = 0;
    const place = (doc: MotionDoc, id: string, at: number) => must(insertTemplate(doc, builtinTemplate(`builtin:${id}`)!, { from: at, newId: () => `x${++n}` }));
    const varied = place(place(place(newMotionDoc(MotionFormat.Landscape), 'scene-hero-title', 0), 'scene-big-number', 90), 'scene-hero-title', 195);
    const twice = place(place(newMotionDoc(MotionFormat.Landscape), 'scene-hero-title', 0), 'scene-hero-title', 90);

    expect(kinds(varied)).toEqual([]);
    expect(kinds(twice)).toContain(Quality.RepeatedLayout);
  });

  it('an effect the style forbids is named by the gate', () => {
    const sparkling = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Particles', from: 0, durationInFrames: 60 }, 'p'));

    expect(kinds(sparkling)).toContain(Quality.OffStyle);
  });

  it('music in the project that the video never plays is named', () => {
    expect(docProblems(dubLike(), { audioAssets: 1 }).map((p) => p.kind)).toContain(Quality.Silent);
  });

  it('a flat frame and a frame half white are named with their time', () => {
    const problems = frameProblems([
      { time: 0.5, lumaStd: 1, whiteShare: 0 },
      { time: 3, lumaStd: 40, whiteShare: 0.3 },
      { time: 6, lumaStd: 40, whiteShare: 0.02 }
    ]);

    expect(problems.map((p) => [p.kind, p.at])).toEqual([
      [Quality.BlankFrame, 0.5],
      [Quality.WhiteArea, 3]
    ]);
  });
});
