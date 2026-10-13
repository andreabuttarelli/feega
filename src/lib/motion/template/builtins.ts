import { LAYOUTS } from '$lib/canvas/composition/index';
import type { LayoutId, LayoutParam } from '$lib/canvas/composition/types';
import { COMPOSITION_CAMERAS, TITLE_LOOK } from '$lib/motion/components';
import { Ease, TransitionKind } from '$lib/motion/design';
import { FADE_OUT, RISE, edge, type Beat } from '$lib/motion/template-kit';
import { FieldType } from './fields';
import type { TemplateEntry } from './library';
import { backdrop, boxAspect, build, colour, text, type Design, type Field } from './design-kit';
import { SCENES } from './scenes';
import { LAUNCH_SCENES } from './launch-scenes';
import { UI_MORPH_TEMPLATE } from '../ui-morph/template';
import { PROMPT_INPUT_TEMPLATE } from './prompt-input/template';
import { FLOATING_MEDIA_TEMPLATE } from './floating-media/template';
import { PHOTO_STRIP_TEMPLATE } from './photo-strip/template';
import { FEATURE_SCROLL_TEMPLATE } from './feature-scroll/template';
import { SPLIT_HEADLINE_TEMPLATE } from './split-headline/template';
import { IMAGE_GLOBE_TEMPLATE } from './image-globe/template';
import { SAAS_MONITOR_TEMPLATE } from './saas-monitor/template';
import { WIRE_GLOBE_PAGES_TEMPLATE } from './wire-globe-pages/template';
import { PGRID_TEMPLATES } from './parallax-grid/template';
import { EDITORIAL_WORDS_MEDIA_TEMPLATE } from './editorial-words-media/template';
import { SCROLL_STORY_TEMPLATE } from './scroll-story/template';
import { COMMENT_GRID_TEMPLATE } from './comment-grid/template';
import { PHONE_SPLIT_TEMPLATE } from './phone-split/template';
import { MARQUEE_TEMPLATE } from './marquee/template';
import { CIRCULAR_CAROUSEL_TEMPLATE } from './circular-carousel/template';
import { ROWS_SPACED_TITLE_TEMPLATE } from './rows-spaced-title/template';
import { STEPS_LIST_TEMPLATE } from './steps-list/template';
import { SCATTER_TITLE_TEMPLATE } from './scatter-title/template';
import { COLLAGE_STACK_TEMPLATE } from './collage-stack-rotate/template';
import { RING_THROUGH_TITLE_TEMPLATE } from './ring-through-title/template';
import { MEDIA_CLOUD_TEMPLATE } from './media-cloud/template';
import { BRACKET_GRADIENT_TEMPLATE } from './bracket-gradient/template';
import { STACK_WORDS_TEMPLATE } from './stack-words/template';
import { PARTICLE_RIBBON_TEMPLATE } from './particle-ribbon/template';
import { WORD_WHEEL_UI_TEMPLATE } from './word-wheel-ui/template';
import { MELTING_TYPE_POSTER_TEMPLATE } from './melting-type-poster/template';
import { POSTER_LIQUID_GLASS_TEMPLATE } from './poster-liquid-glass/template';
import { PHONE_CHAT_TEMPLATE } from './phone-chat/template';
import { PATH_CARDS_TEMPLATE } from './path-cards/template';
import { INTRODUCING_BADGE_TEMPLATE } from './introducing-badge/template';
import { IRIDESCENT_BLOBS_TEMPLATE } from './iridescent-blobs/template';
import { FLOW_LINES_TEMPLATE } from './flow-lines/template';
import { TYPE_GRID_POSTER_TEMPLATE } from './type-grid-poster/template';
import { CHECKER_STEPS_POSTER_TEMPLATE } from './checker-steps-poster/template';
import { OVERLAY_GRID_POSTER_TEMPLATE } from './overlay-grid-poster/template';
import { CIRCLE_EVENT_POSTER_TEMPLATE } from './circle-event-poster/template';
import { BLOCK_TITLE_POSTER_TEMPLATE } from './block-title-poster/template';
import { BOXED_TYPE_POSTER_TEMPLATE } from './boxed-type-poster/template';
import { SQUARE_WORDS_POSTER_TEMPLATE } from './square-words-poster/template';
import { ISO_BLOCKS_POSTER_TEMPLATE } from './iso-blocks-poster/template';
import { PHOTO_GRID_POSTER_TEMPLATE } from './photo-grid-poster/template';
import { WHITE_SHAPES_POSTER_TEMPLATE } from './white-shapes-poster/template';
import { VERTICAL_TYPE_POSTER_TEMPLATE } from './vertical-type-poster/template';

export { BUILTIN_PREFIX } from './design-kit';

const INK = '#0a0a0a';
const PAPER = '#f4f1ea';
const WHITE = '#ffffff';
const ORANGE = '#ff5a1f';

const WIPE = edge(TransitionKind.Wipe, 0.4);
const POP: Beat['keys'] = { scale: [[0, 0.9], [0.6, 1, Ease.Enter]] };

const PHOTO = { width: 0.36, height: 0.5 };
const LOGO = { width: 0.12, height: 0.2 };

const DESIGNS: Design[] = [
  {
    id: 'lower-third',
    name: 'Lower third',
    description: 'Name and role on an accent bar, bottom left.',
    seconds: 5,
    beats: [
      { id: 'bar', track: 'back', component: 'Shape', at: 0, len: 5, props: { shape: 'rect', fill: ORANGE, x: 0.25, y: 0.83, width: 0.4, height: 0.15 }, enter: WIPE, exit: FADE_OUT },
      { id: 'name', track: 'front', component: 'Title', at: 0.2, len: 4.8, props: { text: 'Ada Lovelace', color: WHITE, size: 0.05, x: 0.25, y: 0.81, width: 0.36, height: 0.07, align: 'left' }, exit: FADE_OUT },
      { id: 'role', track: 'middle', component: 'Kicker', at: 0.4, len: 4.6, props: { text: 'Engineer', color: WHITE, x: 0.25, y: 0.87, width: 0.36, height: 0.04, align: 'left' }, enter: RISE, exit: FADE_OUT }
    ],
    fields: [text('name', 'Name', 'name'), text('role', 'Role', 'role'), colour('accent', 'Bar colour', 'bar', 'fill')]
  },
  {
    id: 'title-card',
    name: 'Title card',
    description: 'A full-frame title with a kicker above it.',
    seconds: 4,
    beats: [
      backdrop(INK, 4),
      { id: 'kicker', track: 'middle', component: 'Kicker', at: 0.2, len: 3.6, props: { text: '( Chapter one )', color: ORANGE, y: 0.34 }, enter: RISE, exit: FADE_OUT },
      { id: 'title', track: 'front', component: 'Title', at: 0.3, len: 3.5, props: { text: 'The long way\nround.', color: WHITE, y: 0.52, size: 0.12 }, exit: FADE_OUT }
    ],
    fields: [text('kicker', 'Kicker', 'kicker'), text('title', 'Title', 'title'), colour('background', 'Background', 'bg', 'fill'), colour('text_color', 'Title colour', 'title', 'color')]
  },
  {
    id: 'product-reveal',
    name: 'Product reveal',
    description: 'A product photo pops in, with its name and price.',
    seconds: 5,
    beats: [
      backdrop(PAPER, 5),
      { id: 'photo', track: 'middle', component: 'Image', at: 0, len: 5, props: { x: 0.5, y: 0.4, ...PHOTO }, keys: POP, exit: FADE_OUT },
      { id: 'name', track: 'front', component: 'Title', at: 0.6, len: 4.4, props: { text: 'Trail Runner 2', color: INK, size: 0.07, y: 0.77, height: 0.1 }, exit: FADE_OUT },
      { id: 'price', track: 'front', component: 'Kicker', at: 0.9, len: 4.1, props: { text: '€ 129', color: ORANGE, size: 0.035, y: 0.87 }, enter: RISE, exit: FADE_OUT }
    ],
    fields: [
      { key: 'photo', label: 'Product photo', type: FieldType.Asset, clipId: 'photo', prop: 'assetId', aspect: boxAspect(PHOTO.width, PHOTO.height) },
      { key: 'fit', label: 'Photo fit', type: FieldType.Select, clipId: 'photo', prop: 'fit', options: ['cover', 'contain'] },
      text('name', 'Product name', 'name'),
      text('price', 'Price', 'price'),
      colour('text_color', 'Name colour', 'name', 'color'),
      colour('accent', 'Price colour', 'price', 'color'),
      colour('background', 'Background', 'bg', 'fill')
    ]
  },
  {
    id: 'end-card',
    name: 'End card',
    description: 'Logo, call to action and link to close a video.',
    seconds: 4,
    beats: [
      backdrop(INK, 4),
      { id: 'logo', track: 'middle', component: 'Logo', at: 0, len: 4, props: { y: 0.33, ...LOGO }, keys: POP },
      { id: 'cta', track: 'front', component: 'Title', at: 0.3, len: 3.7, props: { text: 'Start free today', color: WHITE, size: 0.08, y: 0.6, height: 0.12 } },
      { id: 'url', track: 'front', component: 'Text', at: 0.6, len: 3.4, props: { text: 'feega.app', color: ORANGE, y: 0.75, size: 0.035 } }
    ],
    fields: [
      { key: 'logo', label: 'Logo', type: FieldType.Asset, clipId: 'logo', prop: 'assetId', aspect: boxAspect(LOGO.width, LOGO.height) },
      text('cta', 'Call to action', 'cta'),
      text('url', 'Link', 'url'),
      colour('background', 'Background', 'bg', 'fill')
    ]
  },
  {
    id: 'social-stat',
    name: 'Social stat',
    description: 'One big number and what it measures.',
    seconds: 4,
    beats: [
      { id: 'stat', track: 'front', component: 'Title', at: 0, len: 4, props: { text: '87%', color: WHITE, size: 0.22, y: 0.42, height: 0.3 }, keys: POP, exit: FADE_OUT },
      { id: 'rule', track: 'middle', component: 'Shape', at: 0.4, len: 3.6, props: { shape: 'rect', fill: ORANGE, y: 0.6, width: 0.16, height: 0.008 }, enter: WIPE, exit: FADE_OUT },
      { id: 'label', track: 'front', component: 'Text', at: 0.6, len: 3.4, props: { text: 'of viewers watched to the end', color: WHITE, y: 0.7, size: 0.04 }, exit: FADE_OUT }
    ],
    fields: [
      text('stat', 'Number', 'stat'),
      text('label', 'What it measures', 'label'),
      colour('accent', 'Rule colour', 'rule', 'fill'),
      { key: 'size', label: 'Number size', type: FieldType.Number, clipId: 'stat', prop: 'size', min: 0.08, max: 0.3 }
    ]
  },
  {
    id: 'quote',
    name: 'Quote',
    description: 'A pull quote with its author.',
    seconds: 5,
    beats: [
      backdrop(PAPER, 5),
      { id: 'mark', track: 'middle', component: 'Title', at: 0, len: 5, props: { text: '“', color: ORANGE, size: 0.3, y: 0.22, height: 0.25 }, exit: FADE_OUT },
      { id: 'quote', track: 'front', component: 'Text', at: 0.3, len: 4.7, props: { text: 'Make the thing you wish existed.', color: INK, size: 0.06, ...TITLE_LOOK, y: 0.5, width: 0.72, height: 0.3 }, exit: FADE_OUT },
      { id: 'author', track: 'front', component: 'Kicker', at: 0.8, len: 4.2, props: { text: '— Ada Lovelace', color: INK, y: 0.72 }, enter: RISE, exit: FADE_OUT }
    ],
    fields: [text('quote', 'Quote', 'quote'), text('author', 'Author', 'author'), colour('accent', 'Mark colour', 'mark', 'color'), colour('background', 'Background', 'bg', 'fill')]
  }
];

const COMPOSITION_SECONDS = 6;

const snake = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const LAYOUT_FIELD: Record<LayoutParam['kind'], (p: LayoutParam) => Partial<Field>> = {
  range: (p) => (p.kind === 'range' ? { type: FieldType.Number, min: p.min, max: p.max } : {}),
  seed: () => ({ type: FieldType.Number }),
  color: () => ({ type: FieldType.Color }),
  select: (p) => (p.kind === 'select' ? { type: FieldType.Select, options: p.options.map((o) => o.value) } : {})
};

function layoutField(p: LayoutParam): Field {
  return { key: snake(p.name), label: p.label, clipId: 'grid', prop: `layoutParams.${p.name}`, default: p.default, ...LAYOUT_FIELD[p.kind](p) } as Field;
}

function compositionDesign(layout: LayoutId): Design {
  return {
    id: `composition-${layout}`,
    name: LAYOUTS[layout].label,
    description: LAYOUTS[layout].description,
    seconds: COMPOSITION_SECONDS,
    beats: [{ id: 'grid', track: 'front', component: 'Composition', at: 0, len: COMPOSITION_SECONDS, props: { layout, loop: COMPOSITION_SECONDS } }],
    fields: [
      { key: 'media', label: 'Pictures and videos', type: FieldType.MediaList, clipId: 'grid', prop: 'media' },
      colour('background', 'Background', 'grid', 'background'),
      { key: 'camera', label: 'Camera', type: FieldType.Select, clipId: 'grid', prop: 'camera', options: [...COMPOSITION_CAMERAS] },
      { key: 'loop', label: 'Loop', type: FieldType.Number, clipId: 'grid', prop: 'loop', min: 0.5, max: 60, unit: 's' },
      ...LAYOUTS[layout].params.map(layoutField)
    ]
  };
}

export const BUILTIN_TEMPLATES: TemplateEntry[] = [...[...LAUNCH_SCENES, ...SCENES, ...DESIGNS, ...(Object.keys(LAYOUTS) as LayoutId[]).map(compositionDesign)].map(build), UI_MORPH_TEMPLATE, PROMPT_INPUT_TEMPLATE, FLOATING_MEDIA_TEMPLATE, PHOTO_STRIP_TEMPLATE, FEATURE_SCROLL_TEMPLATE, IMAGE_GLOBE_TEMPLATE, SPLIT_HEADLINE_TEMPLATE, SCROLL_STORY_TEMPLATE, COMMENT_GRID_TEMPLATE, SAAS_MONITOR_TEMPLATE, PHONE_SPLIT_TEMPLATE, MARQUEE_TEMPLATE, CIRCULAR_CAROUSEL_TEMPLATE, ...PGRID_TEMPLATES, ROWS_SPACED_TITLE_TEMPLATE, SCATTER_TITLE_TEMPLATE, RING_THROUGH_TITLE_TEMPLATE, EDITORIAL_WORDS_MEDIA_TEMPLATE, MEDIA_CLOUD_TEMPLATE, COLLAGE_STACK_TEMPLATE, BRACKET_GRADIENT_TEMPLATE, STACK_WORDS_TEMPLATE, STEPS_LIST_TEMPLATE, INTRODUCING_BADGE_TEMPLATE, MELTING_TYPE_POSTER_TEMPLATE, POSTER_LIQUID_GLASS_TEMPLATE, WIRE_GLOBE_PAGES_TEMPLATE, PHONE_CHAT_TEMPLATE, PATH_CARDS_TEMPLATE, WORD_WHEEL_UI_TEMPLATE, IRIDESCENT_BLOBS_TEMPLATE, PARTICLE_RIBBON_TEMPLATE, FLOW_LINES_TEMPLATE, TYPE_GRID_POSTER_TEMPLATE, CHECKER_STEPS_POSTER_TEMPLATE, OVERLAY_GRID_POSTER_TEMPLATE, CIRCLE_EVENT_POSTER_TEMPLATE, BLOCK_TITLE_POSTER_TEMPLATE, BOXED_TYPE_POSTER_TEMPLATE, SQUARE_WORDS_POSTER_TEMPLATE, ISO_BLOCKS_POSTER_TEMPLATE, PHOTO_GRID_POSTER_TEMPLATE, WHITE_SHAPES_POSTER_TEMPLATE, VERTICAL_TYPE_POSTER_TEMPLATE];

export function builtinTemplate(id: string): TemplateEntry | null {
  return BUILTIN_TEMPLATES.find((e) => e.id === id) ?? null;
}
