import { describe, expect, it } from 'vitest';
import { MotionFormat, parseMotionDoc } from '$lib/motion/doc';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintAdvice, lintSource } from '$lib/motion/custom/lint';
import { EffectKind } from '$lib/motion/effects/registry';
import { DocMode, docMode } from '$lib/motion/still';
import { builtinTemplate } from './builtins';
import { catalogue, matching, starterDoc } from './catalogue';
import type { TemplateEntry } from './library';
import { TYPE_GRID_COMPONENT } from './type-grid-poster/component';
import { TYPE_GRID_POSTER_TEMPLATE, TYPE_GRID_TEMPLATE_ID } from './type-grid-poster/template';
import { CHECKER_COMPONENT } from './checker-steps-poster/component';
import { CHECKER_STEPS_POSTER_TEMPLATE, CHECKER_TEMPLATE_ID } from './checker-steps-poster/template';

const POSTERS: [string, TemplateEntry, string][] = [
  [TYPE_GRID_TEMPLATE_ID, TYPE_GRID_POSTER_TEMPLATE, TYPE_GRID_COMPONENT],
  [CHECKER_TEMPLATE_ID, CHECKER_STEPS_POSTER_TEMPLATE, CHECKER_COMPONENT]
];

const REFERENCE_WORDS = /galeria|azur|berlin|karl|marx/i;

describe.each(POSTERS)('the %s still template', (id, entry, name) => {
  const doc = entry.template.doc;
  const component = doc.components[name];

  it('is a built-in, saved as a valid still doc in the post size', () => {
    expect(builtinTemplate(id)).toBe(entry);
    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(docMode(doc)).toBe(DocMode.Still);
    expect(doc).toMatchObject({ width: 1080, height: 1350 });
  });

  it('ships clean deterministic code whose defaults pass its own schema', () => {
    expect(lintSource(component.source)).toEqual([]);
    expect(lintAdvice(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
  });

  it('keeps every shape a sharp rectangle', () => {
    expect(component.source.css).not.toMatch(/radius/);
  });

  it('has its grain as an editable effect on the poster', () => {
    expect(doc.tracks.flatMap((t) => t.clips).flatMap((c) => c.effects).map((e) => e.kind)).toContain(EffectKind.Noise);
  });

  it('offers at most five key fields, each a real field', () => {
    const keys = entry.template.keyFields ?? [];
    expect(keys.length).toBeLessThanOrEqual(5);
    expect(doc.fields.map((f) => f.key)).toEqual(expect.arrayContaining([...keys]));
  });

  it('carries placeholder copy, nothing from the reference', () => {
    expect(JSON.stringify(doc)).not.toMatch(REFERENCE_WORDS);
  });

  it.each([MotionFormat.Portrait, MotionFormat.Vertical, MotionFormat.Poster])('starts a still in %s', (format) => {
    const started = starterDoc(entry, format, () => 'x');
    expect(started.ok && docMode(started.doc)).toBe(DocMode.Still);
  });

  it('has a picture preview and no video to play', () => {
    expect(catalogue([entry])[0].preview).toEqual({ poster: expect.stringMatching(/\.jpg$/), video: null });
  });

  it('is listed as a still and found by that filter', () => {
    const items = catalogue([entry]);
    expect(items[0].mode).toBe(DocMode.Still);
    expect(matching(items, '', null, DocMode.Still)).toHaveLength(1);
    expect(matching(items, '', null, DocMode.Video)).toHaveLength(0);
  });
});
