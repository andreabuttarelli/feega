import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Forbidden, STYLES, styleProblems } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';
import { EASE_BEZIER } from '$lib/motion/keyframes';
import { Ease } from '$lib/motion/design';
import { BUILTIN_TEMPLATES } from './builtins';
import { insertTemplate } from './library';
import { Quality, docProblems } from '$lib/motion/direction';
import { SCENES } from './scenes';
import { TEMPLATES } from '$lib/motion/hyperframes/templates';

const LINE_OVER_SCENE: ReadonlySet<string> = new Set(['builtin:scene-device-split', 'builtin:scene-media-caption']);

const APPLE = STYLES[MotionStyle.AppleMinimal];
const TEXT = new Set(['Title', 'Text', 'Kicker', 'Caption']);
const NEUTRALS = new Set([APPLE.palette.ink, APPLE.palette.paper, APPLE.palette.muted, 'brand.accent']);
const SIGNED = [APPLE.eases.enter, APPLE.eases.move, EASE_BEZIER[Ease.Linear]].map((b) => JSON.stringify(b));

const sceneDocs = () => BUILTIN_TEMPLATES.filter((e) => e.id.startsWith('builtin:scene-'));
const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips);
const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};

describe('the Apple minimal scene library', () => {
  it('ships 15 to 20 scenes, the keynote set included', () => {
    const names = SCENES.map((s) => s.id);

    expect(names.length).toBeGreaterThanOrEqual(15);
    expect(names.length).toBeLessThanOrEqual(20);
    expect(names).toEqual(
      expect.arrayContaining(['scene-hero-title', 'scene-product-reveal', 'scene-ui-closeup', 'scene-feature-line', 'scene-big-number', 'scene-quote', 'scene-device-hero', 'scene-split-statement', 'scene-logo-end-card', 'scene-dissolve', 'scene-match-cut'])
    );
  });

  it('every scene is a built-in template', () => {
    expect(sceneDocs().map((e) => e.id)).toEqual(SCENES.map((s) => `builtin:${s.id}`));
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s lets every animation finish and holds a second before its cut', (_id, entry) => {
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), entry, { from: 0, newId: ids() });
    const rhythm = placed.ok ? docProblems(placed.doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.CutMidAnimation || p.kind === Quality.NoHold) : [];

    expect(rhythm.map((p) => p.detail)).toEqual([]);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s breaks none of the style rules, alone and inside a video', (_id, entry) => {
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), entry, { from: 0, newId: ids() });

    const kept = (doc: MotionDoc) => styleProblems(doc).filter((p) => !(LINE_OVER_SCENE.has(entry.id) && p.effect === Forbidden.TextOverScene));

    expect(kept(entry.template.doc)).toEqual([]);
    expect(placed.ok && kept(placed.doc)).toEqual([]);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s moves only on the signed eases', (_id, entry) => {
    const eases = clipsOf(entry.template.doc).flatMap((c) => Object.values(c.keyframes).flatMap((track) => track.map((k) => JSON.stringify(k.ease))));

    expect(eases.every((e) => SIGNED.includes(e))).toBe(true);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s sets type very large or very small, in one family', (_id, entry) => {
    const texts = clipsOf(entry.template.doc).filter((c) => TEXT.has(c.component));
    const sizes = texts.map((c) => Number(c.props.size));
    const families = new Set(texts.map((c) => c.props.font));

    expect(sizes.every((size) => size >= APPLE.type.sizes.line || size <= APPLE.type.sizes.small)).toBe(true);
    expect([...families].every((f) => f === APPLE.type.family)).toBe(true);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s stays black and white with one accent', (_id, entry) => {
    const colours = clipsOf(entry.template.doc).flatMap((c) => [c.props.color, c.props.fill].filter((v): v is string => typeof v === 'string'));

    expect(colours.every((c) => NEUTRALS.has(c))).toBe(true);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s sets its text in fast, 0.3 to 0.5 s, and then holds', (_id, entry) => {
    const doc = entry.template.doc;
    const entrances = clipsOf(doc)
      .filter((c) => TEXT.has(c.component))
      .flatMap((c) => {
        const frames = Object.values(c.keyframes).flatMap((track) => (track.length > 1 ? track.map((k) => k.frame) : []));
        return frames.length ? [(Math.max(...frames) - Math.min(...frames)) / doc.fps] : [];
      });

    expect(entrances.every((s) => s >= APPLE.seconds.enter[0] && s <= APPLE.seconds.enter[1])).toBe(true);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s staggers its lines briefly', (_id, entry) => {
    const doc = entry.template.doc;
    const starts = clipsOf(doc)
      .filter((c) => TEXT.has(c.component) && Object.keys(c.keyframes).length)
      .map((c) => c.from)
      .sort((a, b) => a - b);
    const gaps = starts.slice(1).map((f, i) => (f - starts[i]) / doc.fps);

    expect(gaps.every((g) => g <= APPLE.seconds.enter[1])).toBe(true);
  });

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s never shows pieces of letters: no text enters through a line mask', (_id, entry) => {
    const doc = entry.template.doc;
    const masked = clipsOf(doc).filter((c) => {
      if (!TEXT.has(c.component)) {
        return false;
      }
      const tweens = (TEMPLATES[c.component] as { tweens?: (ctx: unknown) => { from: Record<string, unknown> }[] }).tweens;
      return (tweens?.({ id: c.id, p: c.props, start: 0, fps: doc.fps }) ?? []).some((t) => 'yPercent' in t.from);
    });

    expect(masked.map((c) => c.id)).toEqual([]);
  });

  it('the product reveal crops a capture on one section instead of shrinking the whole page', () => {
    const reveal = SCENES.find((s) => s.id === 'scene-product-reveal')!;
    const photo = reveal.beats.find((b) => b.id === 'photo')!;

    expect(photo.props?.fit).toBe('cover');
    expect(reveal.fields.map((f) => f.key)).toEqual(expect.arrayContaining(['focus_x', 'focus_y', 'zoom']));
  });

  it('every scene has its text on screen within the first second', () => {
    const settled = (c: ReturnType<typeof clipsOf>[number]) => c.from + Math.max(0, ...Object.values(c.keyframes).flatMap((track) => track.map((k) => k.frame)));
    const late = sceneDocs().filter((e) => clipsOf(e.template.doc).some((c) => TEXT.has(c.component) && Object.keys(c.keyframes).length && settled(c) > e.template.doc.fps));

    expect(late.map((e) => e.id)).toEqual([]);
  });
});
