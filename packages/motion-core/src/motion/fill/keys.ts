import { Source, ValueKind, type AnimProp, type KeyValue } from '../keyframes';
import { FillType, type Fill, type Stop } from './model';

export const FILL_PREFIX = 'fill';

export enum FillField {
  StopColor = 'color',
  StopPos = 'pos',
  Colour = 'colour',
  Angle = 'angle',
  CentreX = 'cx',
  CentreY = 'cy',
  Radius = 'radius'
}

const STOP = 'stop';
const STOP_FIELDS: readonly string[] = [FillField.StopColor, FillField.StopPos];
const FLAT_FIELDS: readonly string[] = [FillField.Colour, FillField.Angle, FillField.CentreX, FillField.CentreY, FillField.Radius];
const UNIT = { min: 0, max: 1, step: 0.01 };

export type FillRef = { index: number; field: FillField; stop?: number };

export function fillKey(index: number, field: FillField, stop?: number): string {
  return stop === undefined ? `${FILL_PREFIX}.${index}.${field}` : `${FILL_PREFIX}.${index}.${STOP}.${stop}.${field}`;
}

const whole = (text: string | undefined): number | null => (text !== undefined && /^\d+$/.test(text) ? Number(text) : null);

export function fillOfKey(key: string): FillRef | null {
  const [prefix, at, ...rest] = key.split('.');
  const index = whole(at);
  if (prefix !== FILL_PREFIX || index === null) {
    return null;
  }
  if (rest.length === 1 && FLAT_FIELDS.includes(rest[0])) {
    return { index, field: rest[0] as FillField };
  }
  const stop = whole(rest[1]);
  if (rest.length === 3 && rest[0] === STOP && stop !== null && STOP_FIELDS.includes(rest[2])) {
    return { index, field: rest[2] as FillField, stop };
  }
  return null;
}

const colourProp = (key: string, label: string, base: string): AnimProp => ({ key, label, kind: ValueKind.Color, source: Source.Fill, min: 0, max: 0, step: 0, fallback: 0, base });

const numberProp = (key: string, label: string, range: { min: number; max: number; step: number }, base: number): AnimProp => ({ key, label, kind: ValueKind.Number, source: Source.Fill, ...range, fallback: base, base });

const stopProps = (index: number, stops: readonly Stop[]): AnimProp[] =>
  stops.flatMap((s, at) => [colourProp(fillKey(index, FillField.StopColor, at), `Fill ${index + 1} · stop ${at + 1} colour`, s.color), numberProp(fillKey(index, FillField.StopPos, at), `Fill ${index + 1} · stop ${at + 1} position`, UNIT, s.pos)]);

const ANGLE = { min: -360, max: 360, step: 1 };
const RADIUS = { min: 0.01, max: 4, step: 0.01 };

const PROPS: { [T in FillType]: (f: Extract<Fill, { type: T }>, index: number) => AnimProp[] } = {
  [FillType.Solid]: (f, i) => [colourProp(fillKey(i, FillField.Colour), `Fill ${i + 1} colour`, f.color)],
  [FillType.Linear]: (f, i) => [...stopProps(i, f.stops), numberProp(fillKey(i, FillField.Angle), `Fill ${i + 1} · angle`, ANGLE, f.angle)],
  [FillType.Radial]: (f, i) => [
    ...stopProps(i, f.stops),
    numberProp(fillKey(i, FillField.CentreX), `Fill ${i + 1} · centre X`, UNIT, f.center.x),
    numberProp(fillKey(i, FillField.CentreY), `Fill ${i + 1} · centre Y`, UNIT, f.center.y),
    numberProp(fillKey(i, FillField.Radius), `Fill ${i + 1} · radius`, RADIUS, f.radius)
  ],
  [FillType.Angular]: (f, i) => [
    ...stopProps(i, f.stops),
    numberProp(fillKey(i, FillField.Angle), `Fill ${i + 1} · angle`, ANGLE, f.angle),
    numberProp(fillKey(i, FillField.CentreX), `Fill ${i + 1} · centre X`, UNIT, f.center.x),
    numberProp(fillKey(i, FillField.CentreY), `Fill ${i + 1} · centre Y`, UNIT, f.center.y)
  ],
  [FillType.Diamond]: (f, i) => stopProps(i, f.stops),
  [FillType.Image]: () => []
};

export const fillProps = (fills: readonly Fill[]): AnimProp[] => fills.flatMap((f, i) => (PROPS[f.type] as (f: Fill, i: number) => AnimProp[])(f, i));

type Draft = Record<string, unknown> & { stops?: Stop[]; center?: { x: number; y: number } };

const STOP_PATCH: Record<string, (s: Stop, value: KeyValue) => Stop> = {
  [FillField.StopColor]: (s, value) => ({ ...s, color: String(value) }),
  [FillField.StopPos]: (s, value) => ({ ...s, pos: Number(value) })
};

const FLAT_PATCH: Record<string, (f: Draft, value: KeyValue) => Draft> = {
  [FillField.Colour]: (f, value) => ({ ...f, color: String(value) }),
  [FillField.Angle]: (f, value) => ({ ...f, angle: Number(value) }),
  [FillField.CentreX]: (f, value) => ({ ...f, center: { ...f.center!, x: Number(value) } }),
  [FillField.CentreY]: (f, value) => ({ ...f, center: { ...f.center!, y: Number(value) } }),
  [FillField.Radius]: (f, value) => ({ ...f, radius: Number(value) })
};

const OWNERS: Record<FillField, readonly FillType[]> = {
  [FillField.StopColor]: [FillType.Linear, FillType.Radial, FillType.Angular, FillType.Diamond],
  [FillField.StopPos]: [FillType.Linear, FillType.Radial, FillType.Angular, FillType.Diamond],
  [FillField.Colour]: [FillType.Solid],
  [FillField.Angle]: [FillType.Linear, FillType.Angular],
  [FillField.CentreX]: [FillType.Radial, FillType.Angular],
  [FillField.CentreY]: [FillType.Radial, FillType.Angular],
  [FillField.Radius]: [FillType.Radial]
};

function patched(fill: Fill, ref: FillRef, value: KeyValue): Fill {
  const draft = fill as unknown as Draft;
  if (!OWNERS[ref.field].includes(fill.type)) {
    return fill;
  }
  if (ref.stop === undefined) {
    return FLAT_PATCH[ref.field](draft, value) as unknown as Fill;
  }
  const at = ref.stop;
  return draft.stops?.[at] ? ({ ...draft, stops: draft.stops.map((s, i) => (i === at ? STOP_PATCH[ref.field](s, value) : s)) } as unknown as Fill) : fill;
}

export function applyFillKeys(fills: readonly Fill[], values: Record<string, KeyValue>): Fill[] {
  let next = [...fills];
  for (const [key, value] of Object.entries(values)) {
    const ref = fillOfKey(key);
    if (ref && next[ref.index]) {
      next = next.map((f, i) => (i === ref.index ? patched(f, ref, value) : f));
    }
  }
  return next;
}

export function fillValues(fills: readonly Fill[]): Record<string, KeyValue> {
  return Object.fromEntries(fillProps(fills).map((p) => [p.key, p.base as KeyValue]));
}

const sameKeys = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((key, i) => key === b[i]);

export function splitFillEdit(base: readonly Fill[], shown: readonly Fill[], next: readonly Fill[], keyed: ReadonlySet<string>): { fills: Fill[]; keyedValues: Record<string, KeyValue> } {
  const was = fillValues(shown);
  const now = fillValues(next);
  if (!sameKeys(Object.keys(was), Object.keys(now))) {
    return { fills: [...next], keyedValues: {} };
  }
  const moved = Object.keys(now).filter((key) => keyed.has(key) && now[key] !== was[key]);
  const stored = fillValues(base);
  return {
    fills: applyFillKeys(next, Object.fromEntries([...keyed].filter((key) => key in now && key in stored).map((key) => [key, stored[key]]))),
    keyedValues: Object.fromEntries(moved.map((key) => [key, now[key]]))
  };
}
