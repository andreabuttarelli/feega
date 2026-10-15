// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MotionFormat, parseMotionDoc } from '$lib/motion/doc';
import { customValues, PropFormat, Strictness } from '$lib/motion/custom/component';
import { lintAdvice, lintSource } from '$lib/motion/custom/lint';
import { EffectKind } from '$lib/motion/effects/registry';
import { DocMode, docMode } from '$lib/motion/still';
import { builtinTemplate } from './builtins';
import { PART_FIELDS_BY_POSTER } from '$lib/motion/inspector';
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
import { CURATED_BOARD_COMPONENT } from './curated-board-poster/component';
import { CURATED_BOARD_POSTER_TEMPLATE, CURATED_BOARD_TEMPLATE_ID } from './curated-board-poster/template';
import { REPEAT_LINEUP_COMPONENT } from './repeat-lineup-poster/component';
import { REPEAT_LINEUP_POSTER_TEMPLATE, REPEAT_LINEUP_TEMPLATE_ID } from './repeat-lineup-poster/template';
import { FESTIVAL_GRID_COMPONENT } from './festival-grid-poster/component';
import { FESTIVAL_GRID_POSTER_TEMPLATE, FESTIVAL_GRID_TEMPLATE_ID } from './festival-grid-poster/template';
import { WIDE_FILMSTRIP_COMPONENT } from './wide-filmstrip-poster/component';
import { WIDE_FILMSTRIP_POSTER_TEMPLATE, WIDE_FILMSTRIP_TEMPLATE_ID } from './wide-filmstrip-poster/template';
import { SCATTERED_TYPE_COMPONENT } from './scattered-type-poster/component';
import { SCATTERED_TYPE_POSTER_TEMPLATE, SCATTERED_TYPE_TEMPLATE_ID } from './scattered-type-poster/template';
import { SLICED_PHOTO_COMPONENT } from './sliced-photo-poster/component';
import { SLICED_PHOTO_POSTER_TEMPLATE, SLICED_PHOTO_TEMPLATE_ID } from './sliced-photo-poster/template';
import { RED_NUMBER_COMPONENT } from './red-number-poster/component';
import { RED_NUMBER_POSTER_TEMPLATE, RED_NUMBER_TEMPLATE_ID } from './red-number-poster/template';
import { HAZE_GRID_COMPONENT } from './haze-grid-poster/component';
import { HAZE_GRID_POSTER_TEMPLATE, HAZE_GRID_TEMPLATE_ID } from './haze-grid-poster/template';
import { FLOW_QUOTE_COMPONENT } from './flow-quote-poster/component';
import { FLOW_QUOTE_POSTER_TEMPLATE, FLOW_QUOTE_TEMPLATE_ID } from './flow-quote-poster/template';
import { STACKED_PLUS_COMPONENT } from './stacked-plus-poster/component';
import { STACKED_PLUS_POSTER_TEMPLATE, STACKED_PLUS_TEMPLATE_ID } from './stacked-plus-poster/template';
import { BARCODE_TABLE_COMPONENT } from './barcode-table-poster/component';
import { BARCODE_TABLE_POSTER_TEMPLATE, BARCODE_TABLE_TEMPLATE_ID } from './barcode-table-poster/template';
import { PIXEL_CAPS_COMPONENT } from './pixel-caps-poster/component';
import { PIXEL_CAPS_POSTER_TEMPLATE, PIXEL_CAPS_TEMPLATE_ID } from './pixel-caps-poster/template';
import { MONTH_GRID_COMPONENT } from './month-grid-poster/component';
import { MONTH_GRID_POSTER_TEMPLATE, MONTH_GRID_TEMPLATE_ID } from './month-grid-poster/template';
import { ROTATED_CARDS_COMPONENT } from './rotated-cards-poster/component';
import { ROTATED_CARDS_POSTER_TEMPLATE, ROTATED_CARDS_TEMPLATE_ID } from './rotated-cards-poster/template';
import { BRICK_CAPS_COMPONENT } from './brick-caps-poster/component';
import { BRICK_CAPS_POSTER_TEMPLATE, BRICK_CAPS_TEMPLATE_ID } from './brick-caps-poster/template';
import { DARK_TAGS_COMPONENT } from './dark-tags-poster/component';
import { DARK_TAGS_POSTER_TEMPLATE, DARK_TAGS_TEMPLATE_ID } from './dark-tags-poster/template';
import { POSTER_BATCH_6 } from './poster-batch-6';

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
  [VERTICAL_TYPE_TEMPLATE_ID, VERTICAL_TYPE_POSTER_TEMPLATE, VERTICAL_TYPE_COMPONENT],
  [CURATED_BOARD_TEMPLATE_ID, CURATED_BOARD_POSTER_TEMPLATE, CURATED_BOARD_COMPONENT],
  [REPEAT_LINEUP_TEMPLATE_ID, REPEAT_LINEUP_POSTER_TEMPLATE, REPEAT_LINEUP_COMPONENT],
  [FESTIVAL_GRID_TEMPLATE_ID, FESTIVAL_GRID_POSTER_TEMPLATE, FESTIVAL_GRID_COMPONENT],
  [WIDE_FILMSTRIP_TEMPLATE_ID, WIDE_FILMSTRIP_POSTER_TEMPLATE, WIDE_FILMSTRIP_COMPONENT],
  [SCATTERED_TYPE_TEMPLATE_ID, SCATTERED_TYPE_POSTER_TEMPLATE, SCATTERED_TYPE_COMPONENT],
  [SLICED_PHOTO_TEMPLATE_ID, SLICED_PHOTO_POSTER_TEMPLATE, SLICED_PHOTO_COMPONENT],
  [RED_NUMBER_TEMPLATE_ID, RED_NUMBER_POSTER_TEMPLATE, RED_NUMBER_COMPONENT],
  [HAZE_GRID_TEMPLATE_ID, HAZE_GRID_POSTER_TEMPLATE, HAZE_GRID_COMPONENT],
  [FLOW_QUOTE_TEMPLATE_ID, FLOW_QUOTE_POSTER_TEMPLATE, FLOW_QUOTE_COMPONENT],
  [STACKED_PLUS_TEMPLATE_ID, STACKED_PLUS_POSTER_TEMPLATE, STACKED_PLUS_COMPONENT],
  [BARCODE_TABLE_TEMPLATE_ID, BARCODE_TABLE_POSTER_TEMPLATE, BARCODE_TABLE_COMPONENT],
  [PIXEL_CAPS_TEMPLATE_ID, PIXEL_CAPS_POSTER_TEMPLATE, PIXEL_CAPS_COMPONENT],
  [MONTH_GRID_TEMPLATE_ID, MONTH_GRID_POSTER_TEMPLATE, MONTH_GRID_COMPONENT],
  [ROTATED_CARDS_TEMPLATE_ID, ROTATED_CARDS_POSTER_TEMPLATE, ROTATED_CARDS_COMPONENT],
  [BRICK_CAPS_TEMPLATE_ID, BRICK_CAPS_POSTER_TEMPLATE, BRICK_CAPS_COMPONENT],
  [DARK_TAGS_TEMPLATE_ID, DARK_TAGS_POSTER_TEMPLATE, DARK_TAGS_COMPONENT],
  ...POSTER_BATCH_6
];

const NOT_A_PART: (string | undefined)[] = [PropFormat.Color, PropFormat.Font, PropFormat.Media];

const TIMELINE = { to: () => TIMELINE };

function drawnHtml(js: string, props: Record<string, unknown>): string {
  const root = document.createElement('div');
  new Function('root', 'props', 'tl', 'duration', 'assets', js)(root, props, TIMELINE, 2, {});
  return root.innerHTML;
}

const REFERENCE_WORDS = /cosmic|aoxomoxoa|aachen|myspace|smets|sibel|thorwart|tomek|kennedy|tomorrow|marvels|new york|paju|isang|moving sites|wine|cheese and|galeria|azur|berlin|karl|marx|ferran|adri|interbrand|wooster|soho|intef|darmstadt|doda|fassbender|guadagnino|cholovdenko|malek|laverne|tenderness|ui\/ux|inspo|6tm|radioactive|afrodeutsche|sybil|brighton|marine parade|hullabaloo|figueres|moritz|escapism|zemun|kapetanija|gligorijevi|sonnenstub|woolloo|firstdraft|more club|makes no sense|sensations with|stage of life|figured out|yodiz|gaskessel|extraset|katowice|lingang|shanghai|figma|skydiving|salarkhan|futurneue|mateco/i;

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

  it('keeps each font inside its style attribute', () => {
    const values = customValues(component, {}, Strictness.Strict);
    const html = drawnHtml(component.source.js, values.ok ? values.values : {});
    expect(html).not.toContain('system-ui,=""');
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
    expect(drawn.filter((prop) => ![`part('${prop}'`, `textPart(p, '${prop}'`, `labelPart(p, '${prop}'`].some((tag) => component.source.js.includes(tag)))).toEqual([]);
  });
});

describe('the part field table', () => {
  const schemaOf = (name: string) => [...POSTERS, ...PART_TAGGED].map(([, entry]) => entry.template.doc.components[name]).find(Boolean)?.propsSchema.properties;

  it.each(Object.entries(PART_FIELDS_BY_POSTER))('%s names only parts and fields it has', (name, rows) => {
    const props = schemaOf(name);
    expect(props, name).toBeDefined();
    for (const [part, fields] of Object.entries(rows)) {
      expect(Object.keys(props!)).toEqual(expect.arrayContaining([part, ...fields]));
    }
  });
});
