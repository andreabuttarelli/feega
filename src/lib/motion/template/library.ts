import { z } from 'zod';
import { TrackKind } from '$lib/motion/components';
import { motionDocSchema, parseMotionDoc, type MotionClip, type MotionComp, type MotionDoc, type MotionTrack } from '$lib/motion/doc';
import { addClip, addTrack } from '$lib/motion/timeline';
import { MAX_FIELDS, type ExposedField } from './field-model';
import { applyValues, fieldValues, locateClip, setField, type FieldValue } from './fields';
import { keyFieldsSchema, type KeyFields } from './key-fields';
import { VAR_PREFIX, paramVar } from '$lib/motion/custom/component';
import { DEFAULT_INTERACTIVE, interactiveOf } from '$lib/motion/interactive/settings';
import { MAX_VARS, coerceVars, type VarDecl } from '$lib/motion/interactive/var-model';

export const motionTemplateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(200).default(''),
  keyFields: keyFieldsSchema,
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

const TEXT_STACKS: ReadonlySet<string> = new Set(['Title', 'Text', 'Kicker', 'Caption']);
const tallness = (frame: Pick<MotionDoc, 'width' | 'height'>) => frame.height / Math.min(frame.width, frame.height);

function stackedFor(clip: MotionClip, squeeze: number): MotionClip {
  if (squeeze === 1 || !TEXT_STACKS.has(clip.component)) {
    return clip;
  }
  const toCentre = (y: number) => 0.5 + (y - 0.5) * squeeze;
  const y = clip.keyframes.y;
  return {
    ...clip,
    props: { ...clip.props, y: toCentre(Number(clip.props.y ?? 0.5)), height: Number(clip.props.height ?? 1) * squeeze },
    keyframes: y ? { ...clip.keyframes, y: y.map((k) => ({ ...k, value: Number(k.value) * squeeze })) } : clip.keyframes
  };
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

const varPrefixOf = (clip: Pick<MotionClip, 'props'>) => (typeof clip.props[VAR_PREFIX] === 'string' ? (clip.props[VAR_PREFIX] as string) : null);

function freePrefix(base: string, taken: readonly VarDecl[]): string {
  const used = (prefix: string) => taken.some((v) => v.name.startsWith(`${prefix}_`));
  let prefix = base;
  for (let n = 2; used(prefix); n++) {
    prefix = `${base}${n}`;
  }
  return prefix;
}

function prefixMoves(source: MotionDoc, taken: readonly VarDecl[]): Map<string, string> {
  const prefixes = new Set([...clipsIn(source.tracks), ...Object.values(source.comps).flatMap((c) => clipsIn(c.tracks))].map(varPrefixOf).filter((p): p is string => Boolean(p)));
  return new Map([...prefixes].map((p) => [p, freePrefix(p, taken)]));
}

function movedVars(vars: readonly VarDecl[], moves: ReadonlyMap<string, string>): VarDecl[] {
  return vars.map((v) => {
    const from = [...moves.keys()].find((p) => v.name.startsWith(`${p}_`));
    return from ? { ...v, name: `${moves.get(from)}${v.name.slice(from.length)}` } : v;
  });
}

function adoptVars(doc: MotionDoc, vars: VarDecl[]): MotionDoc {
  const mine = interactiveOf(doc);
  if (!vars.length || mine.vars.length + vars.length > MAX_VARS) {
    return doc;
  }
  return { ...doc, interactive: { ...mine, vars: [...mine.vars, ...vars] } };
}

function adoptPlayback(doc: MotionDoc, source: MotionDoc): MotionDoc {
  const { playback, scrollLength } = interactiveOf(source);
  if (interactiveOf(doc).playback !== DEFAULT_INTERACTIVE.playback || playback === DEFAULT_INTERACTIVE.playback) {
    return doc;
  }
  return { ...doc, interactive: { ...interactiveOf(doc), playback, scrollLength } };
}

export function insertTemplate(doc: MotionDoc, entry: TemplateEntry, at: Placement): Inserted {
  const source = entry.template.doc;
  const prefix = at.newId();
  const rename = (id: string) => `${prefix}-${id}`;
  const squeeze = Math.min(1, tallness(source) / tallness(doc));
  const moves = prefixMoves(source, interactiveOf(doc).vars);
  const prefixed = (c: MotionClip) => {
    const own = varPrefixOf(c);
    return own ? { ...c.props, [VAR_PREFIX]: moves.get(own) ?? own } : c.props;
  };
  const clip = (raw: MotionClip): MotionClip => {
    const c = stackedFor(raw, squeeze);
    const ref = compRef(c);
    return { ...c, id: rename(c.id), parent: c.parent ? rename(c.parent) : null, props: ref ? { ...c.props, comp: rename(ref) } : prefixed(c) };
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
  const comp: MotionComp = { template: { id: entry.id, name: entry.template.name, keys, ...(entry.template.keyFields ? { keyFields: entry.template.keyFields } : {}) }, name: entry.template.name, durationInFrames: source.durationInFrames, tracks: tracks(source.tracks.filter((t) => t.kind === TrackKind.Visual)) };
  const next: MotionDoc = {
    ...adoptVars(adoptPlayback(doc, source), movedVars(interactiveOf(source).vars, moves)),
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

export const keyFieldsOf = (doc: MotionDoc, clipId: string): KeyFields => instanceComp(doc, clipId)?.comp.template?.keyFields;

export type Instance = { doc: MotionDoc; clipId: string };

const edited = (f: TemplateFieldValue) => JSON.stringify(f.value) !== JSON.stringify(f.default ?? null);

export function carryEdits(from: Instance, to: Instance): Changed {
  const targets = new Map(templateFields(to.doc, to.clipId).map((f) => [f.key, f]));
  return templateFields(from.doc, from.clipId)
    .filter(edited)
    .reduce<Changed>((current, f) => {
      const target = targets.get(f.key);
      return current.ok && target ? setField(current.doc, target, f.value) : current;
    }, { ok: true, doc: to.doc });
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
  const applied = applyValues(doc, Object.fromEntries(Object.entries(values).map(([k, v]) => [mark.keys[k], v])));
  return applied.ok ? { ok: true, doc: syncedVars(applied.doc, clipId) } : applied;
}

function syncedVars(doc: MotionDoc, clipId: string): MotionDoc {
  const clips = clipsIn(instanceComp(doc, clipId)?.comp.tracks ?? []);
  const driven = new Map(clips.flatMap((c) => {
    const own = varPrefixOf(c);
    return own ? Object.entries(c.props).map(([key, value]) => [paramVar(own, key), value] as const) : [];
  }));
  const mine = interactiveOf(doc);
  const vars = mine.vars.map((v) => {
    const value = coerceVars([v], { [v.name]: driven.get(v.name) })[v.name];
    return value === undefined ? v : ({ ...v, default: value } as VarDecl);
  });
  return { ...doc, interactive: { ...mine, vars } };
}

export function detachTemplate(doc: MotionDoc, clipId: string): Changed {
  const found = instanceComp(doc, clipId);
  if (!found?.comp.template) {
    return fail(`${clipId} is not a template`);
  }
  return { ok: true, doc: { ...doc, comps: { ...doc.comps, [found.id]: unmarked(found.comp) } } };
}
