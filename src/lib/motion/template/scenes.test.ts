import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { STYLES, styleProblems } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';
import { EASE_BEZIER } from '$lib/motion/keyframes';
import { Ease } from '$lib/motion/design';
import { BUILTIN_TEMPLATES } from './builtins';
import { insertTemplate } from './library';
import { SCENES } from './scenes';

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

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s breaks none of the style rules, alone and inside a video', (_id, entry) => {
    const placed = insertTemplate(newMotionDoc(MotionFormat.Landscape), entry, { from: 0, newId: ids() });

    expect(styleProblems(entry.template.doc)).toEqual([]);
    expect(placed.ok && styleProblems(placed.doc)).toEqual([]);
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

  it.each(sceneDocs().map((e) => [e.id, e] as const))('%s enters quickly', (_id, entry) => {
    const doc = entry.template.doc;
    const entrances = clipsOf(doc).flatMap((c) => {
      const fade = c.keyframes.opacity;
      return fade && fade.length > 1 ? [(fade[1].frame - fade[0].frame) / doc.fps] : [];
    });

    expect(entrances.length).toBeGreaterThan(0);
    expect(entrances.every((s) => s >= APPLE.seconds.enter[0] && s <= APPLE.seconds.enter[1])).toBe(true);
  });
});
