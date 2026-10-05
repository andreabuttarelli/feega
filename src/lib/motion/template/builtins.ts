import { LAYOUTS } from '$lib/canvas/composition/index';
import type { LayoutId } from '$lib/canvas/composition/types';
import { COMPOSITION_CAMERAS, TrackKind } from '$lib/motion/components';
import { Ease, TransitionKind } from '$lib/motion/design';
import { MotionFormat, type MotionDoc } from '$lib/motion/doc';
import { FADE_OUT, RISE, assemble, edge, type Beat, type TrackSpec } from '$lib/motion/template-kit';
import { exposeField, FieldType, type FieldInput } from './fields';
import type { TemplateEntry } from './library';

export const BUILTIN_PREFIX = 'builtin:';

type Field = Omit<FieldInput, 'type'> & { type: FieldType };
type Design = { id: string; name: string; description: string; seconds: number; beats: Beat[]; fields: Field[] };

const FORMAT = MotionFormat.Landscape;
const FRAME = { width: 1920, height: 1080 };
const INK = '#0a0a0a';
const PAPER = '#f4f1ea';
const WHITE = '#ffffff';
const ORANGE = '#ff5a1f';

const TRACKS: TrackSpec[] = [
  { id: 'front', kind: TrackKind.Visual, name: 'Front' },
  { id: 'middle', kind: TrackKind.Visual, name: 'Middle' },
  { id: 'back', kind: TrackKind.Visual, name: 'Back' }
];

const WIPE = edge(TransitionKind.Wipe, 0.4);
const POP: Beat['keys'] = { scale: [[0, 0.9], [0.6, 1, Ease.Overshoot]] };
const boxAspect = (width: number, height: number) => Math.round(((width * FRAME.width) / (height * FRAME.height)) * 100) / 100;

const text = (key: string, label: string, clipId: string): Field => ({ key, label, type: FieldType.Text, clipId, prop: 'text' });
const colour = (key: string, label: string, clipId: string, prop: string): Field => ({ key, label, type: FieldType.Color, clipId, prop });
const backdrop = (fill: string, seconds: number): Beat => ({ id: 'bg', track: 'back', component: 'Shape', at: 0, len: seconds, props: { shape: 'rect', fill, x: 0.5, y: 0.5, width: 1, height: 1 } });

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
      { id: 'quote', track: 'front', component: 'Text', at: 0.3, len: 4.7, props: { text: 'Make the thing you wish existed.', color: INK, size: 0.06, y: 0.5, width: 0.72, height: 0.3 }, exit: FADE_OUT },
      { id: 'author', track: 'front', component: 'Kicker', at: 0.8, len: 4.2, props: { text: '— Ada Lovelace', color: INK, y: 0.72 }, enter: RISE, exit: FADE_OUT }
    ],
    fields: [text('quote', 'Quote', 'quote'), text('author', 'Author', 'author'), colour('accent', 'Mark colour', 'mark', 'color'), colour('background', 'Background', 'bg', 'fill')]
  }
];

const COMPOSITION_SECONDS = 6;

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
      { key: 'loop', label: 'Loop', type: FieldType.Number, clipId: 'grid', prop: 'loop', min: 0.5, max: 60, unit: 's' }
    ]
  };
}

function build(design: Design): TemplateEntry {
  let doc: MotionDoc = assemble({ format: FORMAT, seconds: design.seconds, tracks: TRACKS, beats: design.beats });
  doc = { ...doc, tracks: doc.tracks.filter((t) => t.clips.length) };
  for (const field of design.fields) {
    const exposed = exposeField(doc, field);
    if (!exposed.ok) {
      throw new Error(`${design.id}: ${exposed.error}`);
    }
    doc = exposed.doc;
  }
  return { id: `${BUILTIN_PREFIX}${design.id}`, template: { name: design.name, description: design.description, doc } };
}

export const BUILTIN_TEMPLATES: TemplateEntry[] = [...DESIGNS, ...(Object.keys(LAYOUTS) as LayoutId[]).map(compositionDesign)].map(build);

export function builtinTemplate(id: string): TemplateEntry | null {
  return BUILTIN_TEMPLATES.find((e) => e.id === id) ?? null;
}
