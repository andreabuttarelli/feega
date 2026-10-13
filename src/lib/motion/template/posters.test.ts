import { describe, expect, it } from 'vitest';
import { MotionFormat, parseMotionDoc } from '$lib/motion/doc';
import { customValues, PropFormat, Strictness } from '$lib/motion/custom/component';
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
import { ISO_BLOCKS_COMPONENT } from './iso-blocks-poster/component';
import { ISO_BLOCKS_POSTER_TEMPLATE, ISO_BLOCKS_TEMPLATE_ID } from './iso-blocks-poster/template';
import { PHOTO_GRID_COMPONENT } from './photo-grid-poster/component';
import { PHOTO_GRID_POSTER_TEMPLATE, PHOTO_GRID_TEMPLATE_ID } from './photo-grid-poster/template';
import { WHITE_SHAPES_COMPONENT } from './white-shapes-poster/component';
import { WHITE_SHAPES_POSTER_TEMPLATE, WHITE_SHAPES_TEMPLATE_ID } from './white-shapes-poster/template';
import { VERTICAL_TYPE_COMPONENT } from './vertical-type-poster/component';
import { VERTICAL_TYPE_POSTER_TEMPLATE, VERTICAL_TYPE_TEMPLATE_ID } from './vertical-type-poster/template';

const POSTERS: [string, TemplateEntry, string][] = [
  [TYPE_GRID_TEMPLATE_ID, TYPE_GRID_POSTER_TEMPLATE, TYPE_GRID_COMPONENT],
  [CHECKER_TEMPLATE_ID, CHECKER_STEPS_POSTER_TEMPLATE, CHECKER_COMPONENT],
  [OVERLAY_GRID_TEMPLATE_ID, OVERLAY_GRID_POSTER_TEMPLATE, OVERLAY_GRID_COMPONENT],
  [CIRCLE_EVENT_TEMPLATE_ID, CIRCLE_EVENT_POSTER_TEMPLATE, CIRCLE_EVENT_COMPONENT],
  [BLOCK_TITLE_TEMPLATE_ID, BLOCK_TITLE_POSTER_TEMPLATE, BLOCK_TITLE_COMPONENT],
  [BOXED_TYPE_TEMPLATE_ID, BOXED_TYPE_POSTER_TEMPLATE, BOXED_TYPE_COMPONENT],
  [SQUARE_WORDS_TEMPLATE_ID, SQUARE_WORDS_POSTER_TEMPLATE, SQUARE_WORDS_COMPONENT]
];

const PART_TAGGED: [string, TemplateEntry, string][] = [
  [ISO_BLOCKS_TEMPLATE_ID, ISO_BLOCKS_POSTER_TEMPLATE, ISO_BLOCKS_COMPONENT],
  [PHOTO_GRID_TEMPLATE_ID, PHOTO_GRID_POSTER_TEMPLATE, PHOTO_GRID_COMPONENT],
  [WHITE_SHAPES_TEMPLATE_ID, WHITE_SHAPES_POSTER_TEMPLATE, WHITE_SHAPES_COMPONENT],
  [VERTICAL_TYPE_TEMPLATE_ID, VERTICAL_TYPE_POSTER_TEMPLATE, VERTICAL_TYPE_COMPONENT]
];

const NOT_A_PART: (string | undefined)[] = [PropFormat.Color, PropFormat.Font, PropFormat.Media];

const REFERENCE_WORDS = /cosmic|aoxomoxoa|aachen|myspace|smets|sibel|thorwart|tomek|kennedy|tomorrow|marvels|new york|paju|isang|moving sites|wine|cheese and|galeria|azur|berlin|karl|marx|ferran|adri|interbrand|wooster|soho|intef|darmstadt|doda|fassbender|guadagnino|cholovdenko|malek|laverne|tenderness|ui\/ux/i;

describe.each([...POSTERS, ...PART_TAGGED])('the %s still template', (id, entry, name) => {
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

  it('carries marks of its own design beyond the reference, each editable', () => {
    const own = ['caption', 'issue', 'marker', 'counter', 'index', 'blockNumber', 'blockLabel', 'dotLabel'];
    expect(own.filter((key) => key in component.propsSchema.properties).length).toBeGreaterThanOrEqual(2);
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

describe.each(PART_TAGGED)('the %s poster parts', (_id, entry, name) => {
  const component = entry.template.doc.components[name];

  it('tags every key content field it draws, so the canvas can select it', () => {
    const props = component.propsSchema.properties;
    const drawn = entry.template.doc.fields
      .filter((f) => (entry.template.keyFields ?? []).includes(f.key))
      .map((f) => f.prop)
      .filter((prop) => !NOT_A_PART.includes(props[prop]?.format));
    expect(drawn.filter((prop) => !component.source.js.includes(`part('${prop}'`))).toEqual([]);
  });
});
