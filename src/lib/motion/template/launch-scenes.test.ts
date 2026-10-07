import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { STYLES, styleProblems } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';
import { BUILTIN_TEMPLATES } from './builtins';
import { insertTemplate } from './library';
import { LAUNCH_SCENES } from './launch-scenes';
import { Quality, docProblems } from '$lib/motion/direction';

const FILM = STYLES[MotionStyle.LaunchFilm];
const TEXT = new Set(['Title', 'Text', 'Kicker', 'Caption']);
const NEUTRALS = new Set([FILM.palette.ink, FILM.palette.paper, FILM.palette.muted, 'brand.accent', 'transparent']);
const FIRST_MOVE_S = 0.25;

const launchDocs = () => BUILTIN_TEMPLATES.filter((e) => e.id.startsWith('builtin:launch-'));
const clipsOf = (doc: MotionDoc) => [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].flatMap((tracks) => tracks.flatMap((t) => t.clips));
const travel = (values: number[]) => (values.length ? Math.max(...values) - Math.min(...values) : 0);
const ids = () => {
  let n = 0;
  return () => `l${++n}`;
};

describe('the launch film scene library', () => {
  it('ships the techniques of the golden film as six to ten scenes', () => {
    const names = LAUNCH_SCENES.map((s) => s.id);

    expect(names.length).toBeGreaterThanOrEqual(6);
    expect(names.length).toBeLessThanOrEqual(10);
    expect(names).toEqual(expect.arrayContaining(['launch-word-burst', 'launch-ui-speed-ramp', 'launch-device-fly', 'launch-number-match-cut', 'launch-ui-explode', 'launch-device-orbit', 'launch-logo-build']));
  });

  it('every launch scene is a built-in template', () => {
    expect(launchDocs().map((e) => e.id)).toEqual(LAUNCH_SCENES.map((s) => `builtin:${s.id}`));
  });

  it.each(launchDocs().map((e) => [e.id, e] as const))('%s breaks none of the launch film rules, alone and inside a video', (_id, entry) => {
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), entry, { from: 0, newId: ids() });

    expect(styleProblems(entry.template.doc).map((p) => p.detail)).toEqual([]);
    expect(placed.ok && styleProblems(placed.doc)).toEqual([]);
  });

  it.each(launchDocs().map((e) => [e.id, e] as const))('%s is already moving in its first quarter second', (_id, entry) => {
    const doc = entry.template.doc;
    const early = clipsOf(doc).some((c) => c.from <= FIRST_MOVE_S * doc.fps && Object.values(c.keyframes).some((track) => track.length > 1 && track[0].frame <= FIRST_MOVE_S * doc.fps && travel(track.map((k) => Number(k.value))) > 0));

    expect(early).toBe(true);
  });

  it.each(launchDocs().map((e) => [e.id, e] as const))('%s lands its text within a third of a second', (_id, entry) => {
    const doc = entry.template.doc;
    const entrances = clipsOf(doc)
      .filter((c) => TEXT.has(c.component))
      .flatMap((c) => ['opacity', 'blur', 'y'].flatMap((prop) => ((c.keyframes[prop]?.length ?? 0) > 1 ? [(c.keyframes[prop]!.at(-1)!.frame - c.keyframes[prop]![0].frame) / doc.fps] : [])));

    expect(entrances.every((s) => s <= FILM.seconds.enter[1])).toBe(true);
  });

  it.each(launchDocs().map((e) => [e.id, e] as const))('%s keeps a sober palette with one accent', (_id, entry) => {
    const colours = clipsOf(entry.template.doc).flatMap((c) => [c.props.color, c.props.fill, c.props.strokeKind === 'none' ? undefined : c.props.stroke].filter((v): v is string => typeof v === 'string'));

    expect(colours.every((c) => NEUTRALS.has(c))).toBe(true);
  });

  it('the UI explosion is a peak: the gate finds it in a film long enough to need one', () => {
    const explode = launchDocs().find((e) => e.id === 'builtin:launch-ui-explode')!;
    const words = launchDocs().find((e) => e.id === 'builtin:launch-word-burst')!;
    const flat = [0, 2, 4, 6].reduce((doc, s) => {
      const placed = insertTemplate(doc, words, {
        from: s * doc.fps,
        newId: ids()
      });
      return placed.ok ? placed.doc : doc;
    }, newMotionDoc(MotionFormat.Landscape));
    const peaked = insertTemplate(flat, explode, {
      from: 8 * flat.fps,
      newId: ids()
    });

    expect(styleProblems(flat).map((p) => p.effect)).toContain('no-peak');
    expect(peaked.ok && styleProblems(peaked.doc).map((p) => p.effect)).not.toContain('no-peak');
  });

  it('the logo build shows the original logo flat and intact: the build is the light, the shockwave and the address around it', () => {
    const build = launchDocs().find((e) => e.id === 'builtin:launch-logo-build')!;
    const doc = build.template.doc;
    const logo = clipsOf(doc).find((c) => c.id === 'logo')!;
    const withAsset = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'logo' ? { ...c, props: { ...c.props, assetId: 'brand' } } : c)) })) };

    expect(clipsOf(doc).some((c) => c.component === 'Logo3D')).toBe(false);
    expect(logo.component).toBe('Logo');
    expect(docProblems(withAsset, { audioAssets: 0, logos: ['brand'] }).filter((p) => p.kind === Quality.BrandLogoAltered)).toEqual([]);
  });
});
