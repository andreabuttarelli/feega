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
import { OVERLAY_GRID_COMPONENT } from './overlay-grid-poster/component';
import { OVERLAY_GRID_POSTER_TEMPLATE, OVERLAY_GRID_TEMPLATE_ID } from './overlay-grid-poster/template';
import { CIRCLE_EVENT_COMPONENT } from './circle-event-poster/component';
import { CIRCLE_EVENT_POSTER_TEMPLATE, CIRCLE_EVENT_TEMPLATE_ID } from './circle-event-poster/template';
import { BLOCK_TITLE_COMPONENT } from './block-title-poster/component';
import { BLOCK_TITLE_POSTER_TEMPLATE, BLOCK_TITLE_TEMPLATE_ID } from './block-title-poster/template';
import { BOXED_TYPE_COMPONENT } from './boxed-type-poster/component';
import { BOXED_TYPE_POSTER_TEMPLATE, BOXED_TYPE_TEMPLATE_ID } from './boxed-type-poster/template';
import { SQUARE_WORDS_COMPONENT } from './square-words-poster/component';
import { SQUARE_WORDS_POSTER_TEMPLATE, SQUARE_WORDS_TEMPLATE_ID } from './square-words-poster/template';

const POSTERS: [string, TemplateEntry, string][] = [
  [TYPE_GRID_TEMPLATE_ID, TYPE_GRID_POSTER_TEMPLATE, TYPE_GRID_COMPONENT],
  [CHECKER_TEMPLATE_ID, CHECKER_STEPS_POSTER_TEMPLATE, CHECKER_COMPONENT],
  [OVERLAY_GRID_TEMPLATE_ID, OVERLAY_GRID_POSTER_TEMPLATE, OVERLAY_GRID_COMPONENT],
  [CIRCLE_EVENT_TEMPLATE_ID, CIRCLE_EVENT_POSTER_TEMPLATE, CIRCLE_EVENT_COMPONENT],
  [BLOCK_TITLE_TEMPLATE_ID, BLOCK_TITLE_POSTER_TEMPLATE, BLOCK_TITLE_COMPONENT],
  [BOXED_TYPE_TEMPLATE_ID, BOXED_TYPE_POSTER_TEMPLATE, BOXED_TYPE_COMPONENT],
  [SQUARE_WORDS_TEMPLATE_ID, SQUARE_WORDS_POSTER_TEMPLATE, SQUARE_WORDS_COMPONENT]
];

const REFERENCE_WORDS = /galeria|azur|berlin|karl|marx|ferran|adri|interbrand|wooster|soho|intef|darmstadt|doda|fassbender|guadagnino|cholovdenko|malek|laverne|tenderness|ui\/ux/i;

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

  it('keeps every shape a sharp rectangle or a full circle', () => {
    const radii = component.source.css.match(/radius:[^;]+/g) ?? [];
    expect(radii.filter((r) => r !== 'radius: 50%')).toEqual([]);
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
