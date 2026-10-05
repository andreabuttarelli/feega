import { z } from 'zod';
import { TrackKind } from '$lib/motion/components';
import { motionDocSchema, parseMotionDoc, type MotionClip, type MotionComp, type MotionDoc, type MotionTrack } from '$lib/motion/doc';
import { addClip, addTrack } from '$lib/motion/timeline';
import { MAX_FIELDS, type ExposedField } from './field-model';
import { applyValues, fieldValues, locateClip, type FieldValue } from './fields';

export const motionTemplateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(200).default(''),
  doc: motionDocSchema
});

export type MotionTemplate = z.infer<typeof motionTemplateSchema>;
export type TemplateEntry = { id: string; template: MotionTemplate };
export type TemplateMeta = { name: string; description?: string };
export type Made = { ok: true; template: MotionTemplate } | { ok: false; error: string };
export type Inserted = { ok: true; doc: MotionDoc; clipId: string } | { ok: false; error: string };
export type Changed = { ok: true; doc: MotionDoc } | { ok: false; error: string };
export type TemplateFieldValue = FieldValue & { docKey: string };
export type Placement = { from: number; newId: () => string };

const KEY_MAX = 40;
const NO_FIELDS = 'expose at least one field (a text, colour or media slot) before saving a template';

const fail = (error: string) => ({ ok: false as const, error });
const compRef = (clip: Pick<MotionClip, 'component' | 'props'>) => (clip.component === 'Precomp' ? String(clip.props.comp) : null);
const clipsIn = (tracks: readonly MotionTrack[]) => tracks.flatMap((t) => t.clips as MotionClip[]);

function reachable(comps: MotionDoc['comps'], tracks: readonly MotionTrack[]): string[] {
  const seen = new Set<string>();
  const queue = clipsIn(tracks).map(compRef);
  while (queue.length) {
    const id = queue.pop();
    if (!id || seen.has(id) || !comps[id]) {
      continue;
    }
    seen.add(id);
    queue.push(...clipsIn(comps[id].tracks).map(compRef));
  }
  return [...seen];
}

const unmarked = ({ template: _mark, ...comp }: MotionComp): MotionComp => comp;

function made(meta: TemplateMeta, doc: MotionDoc): Made {
  if (!doc.fields.length) {
    return fail(NO_FIELDS);
  }
  const verdict = parseMotionDoc(doc);
  if (!verdict.ok) {
    return fail(verdict.error);
  }
  const parsed = motionTemplateSchema.safeParse({ ...meta, doc: verdict.doc });
  return parsed.success ? { ok: true, template: parsed.data } : fail(parsed.error.issues.map((i) => i.message).join('; '));
}

function contentDoc(doc: MotionDoc, tracks: MotionTrack[], durationInFrames: number, local: (key: string) => string): MotionDoc {
  const ids = reachable(doc.comps, tracks);
  const clipIds = new Set([...clipsIn(tracks), ...ids.flatMap((id) => clipsIn(doc.comps[id].tracks))].map((c) => c.id));
  return {
    ...doc,
    durationInFrames,
    tracks,
    comps: Object.fromEntries(ids.map((id) => [id, unmarked(doc.comps[id])])),
    fields: doc.fields.filter((f) => clipIds.has(f.clipId)).map((f) => ({ ...f, key: local(f.key) })),
    camera: null,
    markers: undefined,
    workArea: null
  };
}

export function templateFromComp(doc: MotionDoc, compId: string, meta: TemplateMeta): Made {
  const comp = doc.comps[compId];
  if (!comp) {
    return fail(`no composition ${compId}`);
  }
  const back = new Map(Object.entries(comp.template?.keys ?? {}).map(([local, key]) => [key, local]));
  return made(meta, contentDoc(doc, comp.tracks, comp.durationInFrames, (key) => back.get(key) ?? key));
}

export function templateFromDoc(doc: MotionDoc, meta: TemplateMeta): Made {
  const visual = doc.tracks.filter((t) => t.kind === TrackKind.Visual);
  return made(meta, contentDoc(doc, visual, doc.durationInFrames, (key) => key));
}

function uniqueKey(key: string, taken: ReadonlySet<string>): string {
  if (!taken.has(key)) {
    return key;
  }
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const next = `${key.slice(0, KEY_MAX - suffix.length)}${suffix}`;
    if (!taken.has(next)) {
      return next;
    }
  }
}

function byName<T>(mine: readonly T[], theirs: readonly T[], name: (item: T) => string): T[] {
  const known = new Set(mine.map(name));
  return [...mine, ...theirs.filter((item) => !known.has(name(item)))];
}

export function insertTemplate(doc: MotionDoc, entry: TemplateEntry, at: Placement): Inserted {
  const source = entry.template.doc;
  const prefix = at.newId();
  const rename = (id: string) => `${prefix}-${id}`;
  const clip = (c: MotionClip): MotionClip => {
    const ref = compRef(c);
    return { ...c, id: rename(c.id), parent: c.parent ? rename(c.parent) : null, props: ref ? { ...c.props, comp: rename(ref) } : c.props };
  };
  const tracks = (list: readonly MotionTrack[]) => list.map((t) => ({ ...t, id: rename(t.id), clips: (t.clips as MotionClip[]).map(clip) }));

  if (doc.fields.length + source.fields.length > MAX_FIELDS) {
    return fail(`a video holds at most ${MAX_FIELDS} fields: detach or remove another template first`);
  }
  const taken = new Set(doc.fields.map((f) => f.key));
  const keys: Record<string, string> = {};
  const fields: ExposedField[] = source.fields.map((f) => {
    const key = uniqueKey(f.key, taken);
    taken.add(key);
    keys[f.key] = key;
    return { ...f, key, clipId: rename(f.clipId) };
  });

  const compId = at.newId();
  const nested = Object.fromEntries(Object.entries(source.comps).map(([id, c]) => [rename(id), { ...unmarked(c), tracks: tracks(c.tracks) }]));
  const comp: MotionComp = { template: { id: entry.id, name: entry.template.name, keys }, name: entry.template.name, durationInFrames: source.durationInFrames, tracks: tracks(source.tracks.filter((t) => t.kind === TrackKind.Visual)) };
  const next: MotionDoc = {
    ...doc,
    comps: { ...doc.comps, ...nested, [compId]: comp },
    fields: [...doc.fields, ...fields],
    assets: byName(doc.assets, source.assets, (a) => a.id),
    fonts: byName(doc.fonts, source.fonts, (f) => JSON.stringify(f)),
    components: { ...source.components, ...doc.components }
  };

  const trackId = at.newId();
  const clipId = at.newId();
  const withTrack = addTrack(next, TrackKind.Visual, trackId, entry.template.name);
  const placed = withTrack.ok ? addClip(withTrack.doc, { component: 'Precomp', trackId, from: at.from, durationInFrames: source.durationInFrames, props: { comp: compId, loop: false } }, clipId) : withTrack;
  return placed.ok ? { ok: true, doc: placed.doc, clipId } : placed;
}

export function instanceComp(doc: MotionDoc, clipId: string): { id: string; comp: MotionComp } | null {
  const found = locateClip(doc, clipId);
  const id = found ? compRef(found.clip) : null;
  return id && doc.comps[id] ? { id, comp: doc.comps[id] } : null;
}

export function isLockedComp(doc: MotionDoc, compId: string): boolean {
  return Boolean(doc.comps[compId]?.template);
}

export function templateFields(doc: MotionDoc, clipId: string): TemplateFieldValue[] {
  const keys = instanceComp(doc, clipId)?.comp.template?.keys ?? {};
  const values = new Map(fieldValues(doc).map((f) => [f.key, f]));
  return Object.entries(keys).flatMap(([local, docKey]) => {
    const value = values.get(docKey);
    return value ? [{ ...value, key: local, docKey }] : [];
  });
}

export function setTemplateValues(doc: MotionDoc, clipId: string, values: Record<string, string>): Changed {
  const mark = instanceComp(doc, clipId)?.comp.template;
  if (!mark) {
    return fail(`${clipId} is not a template: insert one first`);
  }
  const unknown = Object.keys(values).find((k) => !(k in mark.keys));
  if (unknown) {
    return fail(`no field ${unknown}: this template has ${Object.keys(mark.keys).join(', ')}`);
  }
  return applyValues(doc, Object.fromEntries(Object.entries(values).map(([k, v]) => [mark.keys[k], v])));
}

export function detachTemplate(doc: MotionDoc, clipId: string): Changed {
  const found = instanceComp(doc, clipId);
  if (!found?.comp.template) {
    return fail(`${clipId} is not a template`);
  }
  return { ok: true, doc: { ...doc, comps: { ...doc.comps, [found.id]: unmarked(found.comp) } } };
}
