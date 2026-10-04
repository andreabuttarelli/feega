import { findClip, type MotionDoc } from '$lib/motion/doc';
import { setProps, type OpResult } from '$lib/motion/timeline';
import { FIELD_KEY, FieldType, type ExposedField } from './field-model';

export { FieldType, type ExposedField } from './field-model';

export type FieldInput = Omit<ExposedField, 'default'> & { default?: unknown };
export type FieldValue = ExposedField & { value: unknown; missing: boolean };

type Coerce = { expects: string; parse: (raw: string) => unknown | undefined };

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const TRUE = new Set(['true', 'yes', '1', 'y']);
const FALSE = new Set(['false', 'no', '0', 'n']);

const COERCE: Record<FieldType, Coerce> = {
  [FieldType.Text]: { expects: 'text', parse: (raw) => raw },
  [FieldType.Number]: { expects: 'a number', parse: (raw) => (Number.isFinite(Number(raw)) ? Number(raw) : undefined) },
  [FieldType.Color]: { expects: 'a #rrggbb colour', parse: (raw) => (HEX.test(raw) ? raw.toLowerCase() : undefined) },
  [FieldType.Asset]: { expects: 'an asset id', parse: (raw) => raw },
  [FieldType.Boolean]: { expects: 'yes or no', parse: (raw) => (TRUE.has(raw.toLowerCase()) ? true : FALSE.has(raw.toLowerCase()) ? false : undefined) }
};

const propOf = (doc: MotionDoc, field: Pick<ExposedField, 'clipId' | 'prop'>) => findClip(doc, field.clipId)?.clip.props[field.prop];

export function exposeField(doc: MotionDoc, input: FieldInput): OpResult {
  if (!FIELD_KEY.test(input.key)) {
    return { ok: false, error: `"${input.key}" is not a field key: use snake_case, e.g. headline` };
  }
  if (!findClip(doc, input.clipId)) {
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
    const missing = !findClip(doc, f.clipId);
    return { ...f, value: missing ? null : (propOf(doc, f) ?? null), missing };
  });
}

export function applyValues(doc: MotionDoc, values: Record<string, string>): OpResult {
  let current: OpResult = { ok: true, doc };
  for (const field of doc.fields) {
    const raw = values[field.key]?.trim();
    if (!current.ok || !raw) {
      continue;
    }
    const coerce = COERCE[field.type];
    const value = coerce.parse(raw);
    if (value === undefined) {
      return { ok: false, error: `${field.key} expects ${coerce.expects}, got "${raw}"` };
    }
    current = setProps(current.doc, field.clipId, { [field.prop]: value });
  }
  return current;
}
