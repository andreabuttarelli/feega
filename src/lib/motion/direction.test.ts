import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { Side, addClip, setTransition } from './timeline';
import { Quality, docProblems, frameProblems } from './direction';
import { Ease, TransitionKind } from './design';
import { builtinTemplate } from './template/builtins';
import { insertTemplate } from './template/library';
import { MotionStyle } from './style-model';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SCENE = 90;

const calm = (): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.AppleMinimal });

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
    let doc = calm();
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
    const varied = place(place(place(calm(), 'scene-hero-title', 0), 'scene-big-number', 90), 'scene-hero-title', 195);
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

  it('the Dub v3 funnel: a 640 px picture pushed in full frame is named soft, with the largest scale it takes', () => {
    const placed = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: 'funnel', fit: 'cover', width: 1, height: 1 } }, 'i'));
    const pushed = { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, keyframes: { scale: [{ frame: 0, value: 1.12, ease: Ease.Linear }, { frame: 90, value: 1.18, ease: Ease.Linear }] } })) })) };
    const soft = docProblems(pushed, { audioAssets: 0, pixels: { funnel: { width: 640, height: 488 } } }).filter((p) => p.kind === Quality.SoftPicture);
    const sharp = docProblems(pushed, { audioAssets: 0, pixels: { funnel: { width: 3840, height: 2400 } } }).filter((p) => p.kind === Quality.SoftPicture);

    expect(soft).toHaveLength(1);
    expect(soft[0].detail).toContain('0.33');
    expect(sharp).toEqual([]);
  });

  it('a desktop screenshot on a phone screen is named, a mobile one is not', () => {
    const phone = (asset: string) => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Device3D', from: 0, durationInFrames: 90, props: { device: 'phone-pro', screen: asset } }, 'd'));
    const pixels = { desk: { width: 2880, height: 1800 }, mobile: { width: 780, height: 1688 } };
    const cropped = (asset: string) => docProblems(phone(asset), { audioAssets: 0, pixels }).filter((p) => p.kind === Quality.CroppedScreen);

    expect(cropped('desk')).toHaveLength(1);
    expect(cropped('mobile')).toEqual([]);
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

describe('the real brand logo stays as it is', () => {
  const logoClip = (component: 'Image' | 'Logo' | 'Logo3D', patch: Partial<MotionDoc['tracks'][number]['clips'][number]> = {}) => {
    const placed = must(addClip(calm(), { component, from: 0, durationInFrames: 60, props: { assetId: 'brandlogo' } }, 'l'));
    return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'l' ? { ...c, ...patch } : c)) })) };
  };
  const altered = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0, logos: ['brandlogo'] }).filter((p) => p.kind === Quality.BrandLogoAltered);

  it('a flat logo that fades and scales in a little passes', () => {
    const entrance = { opacity: [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }], scale: [{ frame: 0, value: 0.94, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }] };

    expect(altered(logoClip('Logo', { keyframes: entrance }))).toEqual([]);
    expect(altered(logoClip('Image'))).toEqual([]);
  });

  it('names the brand logo extruded in 3D, filtered, blended, masked or turned', () => {
    const turned = { rotateY: [{ frame: 0, value: -90, ease: Ease.Linear }, { frame: 10, value: 0, ease: Ease.Linear }] };

    expect(altered(logoClip('Logo3D'))).toHaveLength(1);
    expect(altered(logoClip('Logo', { effects: [{ id: 'g', kind: 'glow' as never, enabled: true, params: {} }] }))).toHaveLength(1);
    expect(altered(logoClip('Logo', { blend: 'screen' as never }))).toHaveLength(1);
    expect(altered(logoClip('Logo', { mask: { kind: 'ellipse' } as never }))).toHaveLength(1);
    expect(altered(logoClip('Logo', { keyframes: turned }))).toHaveLength(1);
  });

  it('another picture may be treated freely', () => {
    expect(docProblems(logoClip('Logo3D'), { audioAssets: 0, logos: ['other'] }).map((p) => p.kind)).not.toContain(Quality.BrandLogoAltered);
  });
});
