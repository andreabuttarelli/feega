import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FIELD_TYPE_LABEL } from './field-model';
import { insertTemplate, type Inserted, type TemplateEntry } from './library';
import PREVIEWED from './previews.json';

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

export const STARTER_FORMATS = [MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square] as const;
export type StarterFormat = (typeof STARTER_FORMATS)[number];

export type CatalogueItem = {
  id: string;
  name: string;
  description: string;
  seconds: number;
  kind: ComponentKind;
  fields: { label: string; type: string }[];
  preview: Preview | null;
};

export type Preview = { poster: string; video: string };

export const PREVIEW_DIR = 'component-previews';

const previewed: ReadonlySet<string> = new Set(PREVIEWED);

export const previewSlug = (id: string) => id.replace(/[^a-z0-9-]+/gi, '-');

export function previewOf(id: string): Preview | null {
  const slug = previewSlug(id);
  return previewed.has(id) ? { poster: `/${PREVIEW_DIR}/${slug}.jpg`, video: `/${PREVIEW_DIR}/${slug}.mp4` } : null;
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
    fields: e.template.doc.fields.map((f) => ({ label: f.label, type: FIELD_TYPE_LABEL[f.type] })),
    preview: previewOf(e.id)
  }));
  return items.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function matching(items: readonly CatalogueItem[], query: string, kind: ComponentKind | null): CatalogueItem[] {
  const words = query.trim().toLowerCase();
  return items.filter((i) => (!kind || i.kind === kind) && (!words || `${i.name} ${i.description}`.toLowerCase().includes(words)));
}

export function starterDoc(entry: TemplateEntry, format: StarterFormat, newId: () => string): Inserted {
  const source = entry.template.doc;
  const blank = { ...newMotionDoc(format), fps: source.fps, durationInFrames: source.durationInFrames };
  return insertTemplate(blank, entry, { from: 0, newId });
}
