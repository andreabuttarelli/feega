import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { Side, addClip, setTransition } from './timeline';
import { Quality, SEVERITY, Severity, blocking, docProblems, frameProblems } from './direction';
import { Forbidden } from './style';
import supasitoV1 from './fixtures/supasito-v1.json';
import { Ease, TransitionKind } from './design';
import { builtinTemplate } from './template/builtins';
import { insertTemplate } from './template/library';
import { MotionStyle } from './style-model';
import { UI_KIT, UiKind } from './ui-kit/kit';
import { writeComponent } from './custom/ops';

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

const fitted = (doc: MotionDoc): MotionDoc => ({ ...doc, durationInFrames: Math.max(...doc.tracks.flatMap((t) => t.clips.map((c) => c.from + c.durationInFrames))) });

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

    expect(kinds(fitted(doc))).toEqual([]);
  });

  it('scenes from the library are told apart by their template: two different scenes pass, the same one twice repeats', () => {
    let n = 0;
    const place = (doc: MotionDoc, id: string, at: number) => must(insertTemplate(doc, builtinTemplate(`builtin:${id}`)!, { from: at, newId: () => `x${++n}` }));
    const varied = place(place(place(calm(), 'scene-hero-title', 0), 'scene-big-number', 90), 'scene-hero-title', 195);
    const twice = place(place(newMotionDoc(MotionFormat.Landscape), 'scene-hero-title', 0), 'scene-hero-title', 90);

    expect(kinds(fitted(varied))).toEqual([]);
    expect(kinds(twice)).toContain(Quality.RepeatedLayout);
  });

  it('an effect the style forbids is named by the gate', () => {
    const sparkling = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Particles', from: 0, durationInFrames: 60 }, 'p'));

    expect(kinds(sparkling)).toContain(Quality.OffStyle);
  });

  it('a launch film with no music at all is named silent, even with no audio in the project', () => {
    const launch = { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.LaunchFilm };
    const calmFilm = { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.AppleMinimal };

    expect(docProblems(launch, { audioAssets: 0 }).map((p) => p.kind)).toContain(Quality.Silent);
    expect(docProblems(calmFilm, { audioAssets: 0 }).map((p) => p.kind)).not.toContain(Quality.Silent);
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
      { time: 0.5, luma: 120, lumaStd: 1, whiteShare: 0 },
      { time: 3, luma: 160, lumaStd: 40, whiteShare: 0.3 },
      { time: 6, luma: 120, lumaStd: 40, whiteShare: 0.02 }
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

describe('nothing important leaves the frame', () => {
  const placed = (component: 'Title' | 'Custom', props: Record<string, unknown>, keyframes: Record<string, { frame: number; value: number; ease: Ease }[]> = {}) => {
    const piece = UI_KIT[UiKind.StatCards];
    const base = component === 'Custom' ? must(writeComponent(calm(), piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } })) : calm();
    const doc = must(addClip(base, { component, from: 0, durationInFrames: 90, props }, 'c'));
    return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'c' ? { ...c, keyframes } : c)) })) };
  };
  const out = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.OutOfFrame);
  const pump = (to: number) => ({ scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 30, value: to, ease: Ease.Linear }, { frame: 90, value: to, ease: Ease.Linear }] });
  const ui = { name: 'UiStatCards' };

  it('a UI piece pumped past the safe area is named, a gentle push is not', () => {
    expect(out(placed('Custom', ui, pump(1.6)))).toHaveLength(1);
    expect(out(placed('Custom', ui, pump(1.05)))).toEqual([]);
  });

  it('a UI piece slid off the side is named', () => {
    const slid = { x: [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 20, value: 0.4, ease: Ease.Linear }, { frame: 90, value: 0.4, ease: Ease.Linear }] };

    expect(out(placed('Custom', ui, slid))).toHaveLength(1);
  });

  it('a long line of large type that overflows the frame is named, a short word is not', () => {
    expect(out(placed('Title', { text: 'Turn every click into revenue today', size: 0.3, x: 0.5, y: 0.5, width: 1, height: 0.4 }))).toHaveLength(1);
    expect(out(placed('Title', { text: 'Links.', size: 0.2, x: 0.5, y: 0.5, width: 0.9, height: 0.3 }))).toEqual([]);
  });

  it('a move out of frame in the last moments of a clip is a transition, not a fault', () => {
    const exit = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 82, value: 1, ease: Ease.Linear }, { frame: 90, value: 2.5, ease: Ease.Linear }] };

    expect(out(placed('Custom', ui, exit))).toEqual([]);
  });
});

describe('text that cannot be read: tilted or cut, inside a scene too', () => {
  const tilted = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.TiltedText);
  const out = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.OutOfFrame);
  const tilt = (doc: MotionDoc, rotateX: number): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, transform: { ...c.transform, rotateX, perspective: 1600 } })) })) });
  const inScene = (doc: MotionDoc, change: (c: MotionDoc['tracks'][number]['clips'][number]) => MotionDoc['tracks'][number]['clips'][number]): MotionDoc => ({ ...doc, comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: t.clips.map(change) })) }])) });
  const tiltZoom = () => must(insertTemplate(calm(), builtinTemplate('builtin:launch-ui-tilt-zoom')!, { from: 180, newId: () => 'tz' }));

  it('a title held tilted back 18° in 3D is named, a 6° lean is not', () => {
    const doc = must(addClip(calm(), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'All by design', size: 0.12, x: 0.5, y: 0.5, width: 0.8, height: 0.3 } }, 'c'));

    expect(tilted(tilt(doc, 18))).toHaveLength(1);
    expect(tilted(tilt(doc, 6))).toEqual([]);
  });

  it('the UI tilt zoom scene straightens the capture once it has landed', () => {
    expect(tilted(tiltZoom())).toEqual([]);
  });

  it('a capture held tilted inside a scene is named at the time it plays in the film', () => {
    const held = inScene(tiltZoom(), (c) => (c.component === 'Image' ? { ...c, keyframes: { ...c.keyframes, rotateX: [] }, transform: { rotateX: 18, perspective: 1600 } } : c));

    expect(tilted(held)).toHaveLength(1);
    expect(tilted(held)[0].at).toBeGreaterThanOrEqual(6);
    expect(tilted(held)[0].at).toBeLessThan(7);
  });

  it('a line cut by the edge inside a scene is named like one on the main timeline', () => {
    const doc = must(insertTemplate(calm(), builtinTemplate('builtin:launch-device-fly')!, { from: 120, newId: () => 'df' }));
    const wide = inScene(doc, (c) => (c.component === 'Title' ? { ...c, keyframes: {}, props: { ...c.props, text: 'Every site you run, up to date', x: 0.2 } } : c));

    expect(out(wide)).toHaveLength(1);
    expect(out(wide)[0].at).toBeGreaterThanOrEqual(4);
  });
});

describe('empty frames', () => {
  const supasito = supasitoV1 as unknown as MotionDoc;
  const empty = (problems: { kind: Quality; at?: number }[]) => problems.filter((p) => p.kind === Quality.EmptyFrames).map((p) => p.at);

  it('the supasito v1 hole before the logo is named at 11.5 s', () => {
    expect(empty(docProblems(supasito, { audioAssets: 0 }))).toEqual([11.5]);
  });

  it('a film covered from start to end has no hole', () => {
    const blank = newMotionDoc(MotionFormat.Landscape);
    const doc = must(addClip(blank, { component: 'Title', from: 0, durationInFrames: blank.durationInFrames, props: { text: 'Hi' } }, 'a'));

    expect(empty(docProblems(doc, { audioAssets: 0 }))).toEqual([]);
  });

  it('a hard jump from a white frame to a black one is a flash', () => {
    const flat = { lumaStd: 1, whiteShare: 0 };

    expect(empty(frameProblems([{ time: 2, luma: 250, lumaStd: 30, whiteShare: 0.1 }, { time: 2.1, luma: 4, lumaStd: 3, whiteShare: 0 }]))).toEqual([2.1]);
    expect(empty(frameProblems([{ time: 1, luma: 120, ...flat }, { time: 1.1, luma: 125, ...flat }]))).toEqual([]);
  });

  it('an empty frame blocks delivery', () => {
    expect(SEVERITY[Quality.EmptyFrames]).toBe(Severity.Blocking);
  });
});

describe('severity', () => {
  it('blocks delivery on the errors and lets warnings through', () => {
    const open = blocking([
      { kind: Quality.BlankFrame, detail: 'blank' },
      { kind: Quality.RepeatedLayout, detail: 'repeat' },
      { kind: Quality.OffStyle, detail: 'unreadable', effect: Forbidden.ReadingTime },
      { kind: Quality.OffStyle, detail: 'glow', effect: Forbidden.Glow }
    ]);

    expect(open.map((p) => p.detail)).toEqual(['blank', 'unreadable']);
    expect(SEVERITY[Forbidden.MissingStoryBeat]).toBe(Severity.Blocking);
  });
});

describe('the logo in the closing claim', () => {
  const supasito = (): MotionDoc => structuredClone(supasitoV1) as unknown as MotionDoc;
  const clipIn = (doc: MotionDoc, id: string) => doc.comps['347aa400'].tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;
  const smallLogos = (doc: MotionDoc, pixels = {}) => docProblems(doc, { audioAssets: 0, pixels }).filter((p) => p.kind === Quality.SmallLogo);

  it('supasito closed on a logo far smaller than its address: the gate names it', () => {
    expect(smallLogos(supasito())).toHaveLength(1);
  });

  it('a tall mark squeezed into the box reads as narrow as it draws, not as its box', () => {
    const doc = supasito();
    const url = clipIn(doc, '8d3dc9f8-url');
    url.props = { ...url.props, size: 0.03 };
    const asset = String(clipIn(doc, '8d3dc9f8-logo').props.assetId);

    expect(smallLogos(doc, { [asset]: { width: 1200, height: 1200 } })).toEqual([]);
    expect(smallLogos(doc, { [asset]: { width: 100, height: 1200 } })).toHaveLength(1);
  });

  it('the launch logo build ships a logo larger than its address', () => {
    let n = 0;
    const built = must(insertTemplate(newMotionDoc(MotionFormat.Landscape), builtinTemplate('builtin:launch-logo-build')!, { from: 0, newId: () => `k${++n}` }));

    expect(smallLogos(built)).toEqual([]);
  });
});

describe('a cut waits for the scene to finish', () => {
  const FPS = 30;
  const withPiece = (kind: UiKind, seconds: number, props: Record<string, unknown> = {}) => {
    const piece = UI_KIT[kind];
    const base = must(writeComponent(calm(), piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } }));
    return must(addClip(base, { component: 'Custom', from: 0, durationInFrames: Math.round(seconds * FPS), props: { name: piece.name, ...props } }, 'c'));
  };
  const keyed = (keyframes: Record<string, { frame: number; value: number; ease: Ease }[]>) => {
    const doc = must(addClip(calm(), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Hi', x: 0.5, y: 0.5, width: 0.4, height: 0.3 } }, 'c'));
    return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'c' ? { ...c, keyframes } : c)) })) };
  };
  const cuts = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.CutMidAnimation);

  const held = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.NoHold);

  it('a funnel cut while its last stage fills is cut mid-animation; one cut just after is not held; one held a second is clean', () => {
    expect(cuts(withPiece(UiKind.Funnel, 1.5))).toHaveLength(1);
    expect(cuts(withPiece(UiKind.Funnel, 2.4))).toEqual([]);
    expect(held(withPiece(UiKind.Funnel, 2.4))).toHaveLength(1);
    expect([...cuts(withPiece(UiKind.Funnel, 3)), ...held(withPiece(UiKind.Funnel, 3))]).toEqual([]);
  });

  it('a slower piece needs a longer scene', () => {
    expect(cuts(withPiece(UiKind.StatCards, 3.4))).toEqual([]);
    expect(cuts(withPiece(UiKind.StatCards, 3.4, { speed: 0.6 }))).toHaveLength(1);
  });

  it('a move running past the cut is cut mid-animation; one ending half a second before is not held; a long drift and a quick exit are neither', () => {
    const past = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 50, value: 1, ease: Ease.Linear }, { frame: 100, value: 1.3, ease: Ease.Linear }] };
    const late = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 50, value: 1, ease: Ease.Linear }, { frame: 75, value: 1.3, ease: Ease.Linear }] };
    const drift = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 90, value: 1.04, ease: Ease.Linear }] };
    const exit = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 82, value: 1, ease: Ease.Linear }, { frame: 90, value: 2.5, ease: Ease.Linear }] };

    expect(cuts(keyed(past))).toHaveLength(1);
    expect(cuts(keyed(late))).toEqual([]);
    expect(held(keyed(late))).toHaveLength(1);
    expect([...cuts(keyed(drift)), ...held(keyed(drift)), ...cuts(keyed(exit)), ...held(keyed(exit))]).toEqual([]);
  });

  it('a transition out starts the cut: a move still running when it begins is cut mid-animation', () => {
    const early = { scale: [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }, { frame: 60, value: 1.3, ease: Ease.Linear }] };
    const doc = must(setTransition(keyed(early), 'c', Side.Out, { kind: TransitionKind.Fade, durationInFrames: 40 }));

    expect(cuts(keyed(early))).toEqual([]);
    expect(cuts(doc)).toHaveLength(1);
  });

  it('a scene shortened under its own animation is cut mid-animation at the time it plays', () => {
    const placed = must(insertTemplate(calm(), builtinTemplate('builtin:launch-word-burst')!, { from: 0, newId: (() => { let n = 0; return () => `w${++n}`; })() }));
    const short = { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.component === 'Precomp' ? { ...c, durationInFrames: 35 } : c)) })) };

    expect(cuts(short).length).toBeGreaterThan(0);
  });

  it('cuts mid-animation, scenes without a hold and text too short to read block delivery', () => {
    expect([SEVERITY[Quality.CutMidAnimation], SEVERITY[Quality.NoHold], SEVERITY[Forbidden.ReadingTime]]).toEqual([Severity.Blocking, Severity.Blocking, Severity.Blocking]);
  });
});

describe('a background has no seams', () => {
  const backdrop = (props: Record<string, unknown>, scale = 1) => {
    const doc = must(addClip(calm(), { component: 'Shape', from: 0, durationInFrames: 90, props: { fillKind: 'radial', fill: '#16233a', fill2: '#050505', ...props } }, 'bg'));
    return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'bg' ? { ...c, transform: { ...c.transform, scale } } : c)) })) } as MotionDoc;
  };
  const seams = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.BackgroundSeam);

  it('the Dub v4 halo, an ellipse smaller than the frame, is named', () => {
    expect(seams(backdrop({ shape: 'ellipse', x: 0.5, y: 0.55, width: 0.99, height: 0.98 }))).toHaveLength(1);
  });

  it('a gradient that covers the whole frame passes, an ellipse only when its curve clears the corners', () => {
    expect(seams(backdrop({ shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 }))).toEqual([]);
    expect(seams(backdrop({ shape: 'ellipse', x: 0.5, y: 0.5, width: 1, height: 1 }, 1.2))).toHaveLength(1);
    expect(seams(backdrop({ shape: 'ellipse', x: 0.5, y: 0.5, width: 1, height: 1 }, 1.5))).toEqual([]);
  });

  it('a small gradient accent is not a background', () => {
    expect(seams(backdrop({ shape: 'ellipse', x: 0.5, y: 0.4, width: 0.3, height: 0.3 }))).toEqual([]);
  });
});
