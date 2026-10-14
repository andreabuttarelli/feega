import { FORMATS, MotionFormat, formatOf, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { FIELD_TYPE_LABEL } from './field-model';
import { insertTemplate, type Inserted, type Instance, type TemplateEntry } from './library';
import PREVIEWED from './previews.json';
import { DocMode, docMode } from '$lib/motion/still';
import { SectionRole } from './card';
import { templateCard } from './cards';

export enum ComponentKind {
  Component = 'component',
  Layout = 'layout',
  Scene = 'scene'
}

export const KIND_LABEL: Record<ComponentKind, string> = {
  [ComponentKind.Component]: 'Components',
  [ComponentKind.Layout]: 'Media layouts',
  [ComponentKind.Scene]: 'Scenes'
};

export enum AddTarget {
  Video = 'video',
  Composition = 'composition',
  Canvas = 'canvas'
}

export const ADD_TARGET: Record<AddTarget, { label: string; sounds: boolean }> = {
  [AddTarget.Video]: { label: 'Add to video', sounds: true },
  [AddTarget.Composition]: { label: 'Use in composition', sounds: false },
  [AddTarget.Canvas]: { label: 'Add to canvas', sounds: false }
};

export const STARTER_FORMATS = [MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square] as const;
export type StarterFormat = (typeof STARTER_FORMATS)[number];

export enum Edits {
  None = 'none',
  Some = 'some'
}

export function draftToAdd(draft: Instance | null, edits: Edits, format: MotionFormat, opened: MotionFormat): Instance | null {
  return edits === Edits.Some || format !== opened ? draft : null;
}

const isStarter = (f: MotionFormat): f is StarterFormat => (STARTER_FORMATS as readonly MotionFormat[]).includes(f);

export function starterFormatOf(frame: Pick<MotionDoc, 'width' | 'height'>): StarterFormat {
  const format = formatOf(frame);
  return isStarter(format) ? format : STARTER_FORMATS[0];
}

export type CatalogueItem = {
  id: string;
  name: string;
  description: string;
  seconds: number;
  kind: ComponentKind;
  mode: DocMode;
  format: MotionFormat;
  roles: SectionRole[];
  fields: { label: string; type: string }[];
  preview: Preview | null;
};

export type Preview = { poster: string; video: string | null };

export const PREVIEW_DIR = 'component-previews';

const previewed: ReadonlySet<string> = new Set(PREVIEWED);

export const previewSlug = (id: string) => id.replace(/[^a-z0-9-]+/gi, '-');

const PREVIEW_VIDEO: Record<DocMode, (slug: string) => string | null> = {
  [DocMode.Video]: (slug) => `/${PREVIEW_DIR}/${slug}.mp4`,
  [DocMode.Still]: () => null
};

export function previewOf(id: string, mode: DocMode = DocMode.Video): Preview | null {
  const slug = previewSlug(id);
  return previewed.has(id) ? { poster: `/${PREVIEW_DIR}/${slug}.jpg`, video: PREVIEW_VIDEO[mode](slug) } : null;
}

const LAYOUT_COMPONENT = 'Composition';
const CUSTOM_COMPONENT = 'Custom';

export function componentKind(entry: TemplateEntry): ComponentKind {
  const components = entry.template.doc.tracks.flatMap((t) => t.clips.map((c) => c.component));
  if (components.includes(CUSTOM_COMPONENT)) {
    return ComponentKind.Component;
  }
  if (components.length && components.every((c) => c === LAYOUT_COMPONENT)) {
    return ComponentKind.Layout;
  }
  return ComponentKind.Scene;
}

const KIND_ORDER = Object.values(ComponentKind);

export function catalogue(entries: readonly TemplateEntry[]): CatalogueItem[] {
  const items = entries.map((e) => ({
    id: e.id,
    name: e.template.name,
    description: e.template.description,
    seconds: e.template.doc.durationInFrames / e.template.doc.fps,
    kind: componentKind(e),
    mode: docMode(e.template.doc),
    format: ownFormat(e.template.doc),
    roles: templateCard(e.id)?.roles ?? [],
    fields: e.template.doc.fields.map((f) => ({ label: f.label, type: FIELD_TYPE_LABEL[f.type] })),
    preview: previewOf(e.id, docMode(e.template.doc))
  }));
  return items.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

const searchable = (i: CatalogueItem) => `${i.name} ${i.description} ${i.roles.join(' ')}`.toLowerCase();

export function matching(items: readonly CatalogueItem[], query: string, kind: ComponentKind | null, mode: DocMode | null = null, role: SectionRole | null = null): CatalogueItem[] {
  const words = query.trim().toLowerCase();
  return items.filter((i) => (!kind || i.kind === kind) && (!mode || i.mode === mode) && (!role || i.roles.includes(role)) && (!words || searchable(i).includes(words)));
}

export const rolesIn = (items: readonly CatalogueItem[]): SectionRole[] => Object.values(SectionRole).filter((r) => items.some((i) => i.roles.includes(r)));

const SHAPE_RANK: Record<MotionFormat, number> = {
  [MotionFormat.Landscape]: 0,
  [MotionFormat.Vertical]: 1,
  [MotionFormat.Portrait]: 2,
  [MotionFormat.Poster]: 3,
  [MotionFormat.Square]: 4,
  [MotionFormat.SquareLarge]: 5
};

const SHAPE_ORDER = (Object.keys(SHAPE_RANK) as MotionFormat[]).sort((a, b) => SHAPE_RANK[a] - SHAPE_RANK[b]);

export type ShapeGroup = { format: MotionFormat; items: CatalogueItem[] };

export function byShape(items: readonly CatalogueItem[]): ShapeGroup[] {
  return SHAPE_ORDER.map((format) => ({ format, items: items.filter((i) => i.format === format) })).filter((g) => g.items.length);
}

const LENGTH: Record<DocMode, (i: CatalogueItem) => string> = {
  [DocMode.Video]: (i) => `${Math.round(i.seconds * 10) / 10}s`,
  [DocMode.Still]: () => 'still'
};

export const metaLine = (i: CatalogueItem): string => `${FORMATS[i.format].label} · ${LENGTH[i.mode](i)}`;

export const POSTER_FORMATS = [MotionFormat.Portrait, MotionFormat.Vertical, MotionFormat.Poster] as const;
export type PosterFormat = (typeof POSTER_FORMATS)[number];

export const FORMATS_OF_MODE: Record<DocMode, readonly MotionFormat[]> = {
  [DocMode.Video]: STARTER_FORMATS,
  [DocMode.Still]: POSTER_FORMATS
};

function ownFormat(doc: MotionDoc): MotionFormat {
  const offered = FORMATS_OF_MODE[docMode(doc)];
  const format = formatOf(doc);
  return offered.includes(format) ? format : offered[0];
}

export function libraryFormat(item: Pick<CatalogueItem, 'mode' | 'format'>, wanted: MotionFormat): MotionFormat {
  return FORMATS_OF_MODE[item.mode].includes(wanted) ? wanted : item.format;
}

export function posterShelf(items: readonly CatalogueItem[]): CatalogueItem[] {
  return matching(items, '', null, DocMode.Still).sort((a, b) => a.name.localeCompare(b.name));
}

export function starterDoc(entry: TemplateEntry, format: MotionFormat, newId: () => string): Inserted {
  const source = entry.template.doc;
  const blank = { ...newMotionDoc(format), fps: source.fps, durationInFrames: source.durationInFrames, ...(source.still ? { still: source.still } : {}) };
  return insertTemplate(blank, entry, { from: 0, newId });
}
