import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { mergeView, viewOf, type CompPath } from '$lib/motion/precomp';
import { setProps, type OpResult } from '$lib/motion/timeline';
import { CARD_ASPECTS, RATIO_RANGE, type CardAspect } from '$lib/canvas/composition/card-look';
import { CELL_FITS, type CellFit } from '$lib/motion/bento/model';
import { FIELD_KEY, FieldType, type ExposedField } from './field-model';

export { FieldType, type ExposedField } from './field-model';

export type FieldInput = Omit<ExposedField, 'default'> & { default?: unknown };
export type FieldValue = ExposedField & { value: unknown; missing: boolean };

type Coerce = { expects: (field: ExposedField) => string; parse: (raw: string, field: ExposedField) => unknown | undefined };
type Located = { path: CompPath; clip: MotionClip };

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const TRUE = new Set(['true', 'yes', '1', 'y']);
const FALSE = new Set(['false', 'no', '0', 'n']);

const inRange = (n: number, field: ExposedField) => Number.isFinite(n) && n >= (field.min ?? -Infinity) && n <= (field.max ?? Infinity);
const rangeOf = (field: ExposedField) => (field.min !== undefined && field.max !== undefined ? ` from ${field.min} to ${field.max}` : '');

const COERCE: Record<FieldType, Coerce> = {
  [FieldType.Text]: { expects: () => 'text', parse: (raw) => raw },
  [FieldType.Number]: { expects: (f) => `a number${rangeOf(f)}`, parse: (raw, f) => (raw.trim() !== '' && inRange(Number(raw), f) ? Number(raw) : undefined) },
  [FieldType.Color]: { expects: () => 'a #rrggbb colour', parse: (raw) => (HEX.test(raw) ? raw.toLowerCase() : undefined) },
  [FieldType.Asset]: { expects: () => 'an asset id', parse: (raw) => raw },
  [FieldType.Boolean]: { expects: () => 'yes or no', parse: (raw) => (TRUE.has(raw.toLowerCase()) ? true : FALSE.has(raw.toLowerCase()) ? false : undefined) },
  [FieldType.Select]: { expects: (f) => `one of ${(f.options ?? []).join(', ')}`, parse: (raw, f) => (f.options?.includes(raw) ? raw : undefined) },
  [FieldType.MediaList]: { expects: () => 'asset ids separated by commas (video:id for a video; id@4:5 or id@1.3/contain for the card ratio and fit)', parse: (raw) => mediaList(raw) }
};

const VIDEO_PREFIX = 'video:';

const SHAPE_MARK = '@';
const FIT_MARK = '/';

type ListedCard = { assetId: string; kind: 'image' | 'video'; aspect?: CardAspect; ratio?: number; fit?: CellFit };

function shapeOf(raw: string | undefined): Partial<ListedCard> | null {
  if (raw === undefined) {
    return {};
  }
  const [aspect, fit] = raw.split(FIT_MARK).map((s) => s.trim());
  if (fit !== undefined && !CELL_FITS.includes(fit as CellFit)) {
    return null;
  }
  const fitted = fit ? { fit: fit as CellFit } : {};
  if (CARD_ASPECTS.includes(aspect as CardAspect)) {
    return { aspect: aspect as CardAspect, ...fitted };
  }
  const ratio = Number(aspect);
  return aspect && ratio >= RATIO_RANGE.min && ratio <= RATIO_RANGE.max ? { aspect: 'free', ratio, ...fitted } : null;
}

function listed(item: string): ListedCard | null {
  const [id, shape] = item.split(SHAPE_MARK);
  const video = id.startsWith(VIDEO_PREFIX);
  const assetId = (video ? id.slice(VIDEO_PREFIX.length) : id).trim();
  const extra = shapeOf(shape);
  return assetId && extra ? { assetId, kind: video ? 'video' : 'image', ...extra } : null;
}

function mediaList(raw: string): ListedCard[] | undefined {
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(listed);
  return items.length && items.every((i) => i) ? (items as ListedCard[]) : undefined;
}

export function locateClip(doc: MotionDoc, clipId: string): Located | null {
  const root = findClip(doc, clipId);
  if (root) {
    return { path: [], clip: root.clip };
  }
  for (const [id, comp] of Object.entries(doc.comps)) {
    const clip = comp.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (clip) {
      return { path: [id], clip: clip as MotionClip };
    }
  }
  return null;
}

export function setDeepProps(doc: MotionDoc, clipId: string, patch: Record<string, unknown>): OpResult {
  const found = locateClip(doc, clipId);
  if (!found || !found.path.length) {
    return setProps(doc, clipId, patch);
  }
  const inner = setProps(viewOf(doc, found.path), clipId, patch);
  return inner.ok ? { ok: true, doc: mergeView(doc, found.path, inner.doc) } : inner;
}

const PATH = '.';

const propOf = (doc: MotionDoc, field: Pick<ExposedField, 'clipId' | 'prop'>) =>
  field.prop.split(PATH).reduce<unknown>((at, key) => (at as Record<string, unknown> | undefined)?.[key], locateClip(doc, field.clipId)?.clip.props);

export function setField(doc: MotionDoc, field: Pick<ExposedField, 'clipId' | 'prop'>, value: unknown): OpResult {
  const [head, ...rest] = field.prop.split(PATH);
  if (!rest.length) {
    return setDeepProps(doc, field.clipId, { [head]: value });
  }
  const parent = (locateClip(doc, field.clipId)?.clip.props[head] ?? {}) as Record<string, unknown>;
  return setDeepProps(doc, field.clipId, { [head]: { ...parent, [rest.join(PATH)]: value } });
}

export function exposeField(doc: MotionDoc, input: FieldInput): OpResult {
  if (!FIELD_KEY.test(input.key)) {
    return { ok: false, error: `"${input.key}" is not a field key: use snake_case, e.g. headline` };
  }
  if (!locateClip(doc, input.clipId)) {
    return { ok: false, error: `no clip ${input.clipId}` };
  }
  const field: ExposedField = { ...input, default: input.default ?? propOf(doc, input) ?? null };
  const others = doc.fields.filter((f) => f.key !== input.key);
  return { ok: true, doc: { ...doc, fields: [...others, field] } };
}

export function removeField(doc: MotionDoc, key: string): OpResult {
  if (!doc.fields.some((f) => f.key === key)) {
    return { ok: false, error: `no field ${key}` };
  }
  return { ok: true, doc: { ...doc, fields: doc.fields.filter((f) => f.key !== key) } };
}

export function fieldValues(doc: MotionDoc): FieldValue[] {
  return doc.fields.map((f) => {
    const missing = !locateClip(doc, f.clipId);
    return { ...f, value: missing ? null : (propOf(doc, f) ?? null), missing };
  });
}

export function coerceValue(field: ExposedField, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const coerce = COERCE[field.type];
  const value = coerce.parse(raw, field);
  return value === undefined ? { ok: false, error: `${field.key} expects ${coerce.expects(field)}, got "${raw}"` } : { ok: true, value };
}

export function applyValues(doc: MotionDoc, values: Record<string, string>): OpResult {
  let current: OpResult = { ok: true, doc };
  for (const field of doc.fields) {
    const raw = values[field.key]?.trim();
    if (!current.ok || !raw) {
      continue;
    }
    const coerced = coerceValue(field, raw);
    if (!coerced.ok) {
      return coerced;
    }
    current = setField(current.doc, field, coerced.value);
  }
  return current;
}
