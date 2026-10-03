import { z } from 'zod';
import { COMPONENTS, Control, Group, type AssetKind, type ComponentId } from './components';
import { FPS } from './design';
import { Source, ValueKind, animProp, baseValue, sampleColor, sampleTrack, type Animated, type KeyValue } from './keyframes';
import type { MotionClip, MotionDoc } from './doc';
import { MASK_PROPS, type MaskKey } from './mask';
import { removeKeyframes, setKeyframe, setMask, setProps, setTransform, type OpResult } from './timeline';

export type Field = {
  key: string;
  label: string;
  group: Group;
  control: Control;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  assetKind?: AssetKind;
  fallback: unknown;
};

type JsonProp = {
  control?: Control;
  label?: string;
  group?: Group;
  step?: number;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  assetKind?: AssetKind;
  default?: unknown;
};

export const GROUP_ORDER: readonly Group[] = [Group.Content, Group.Style, Group.Layout, Group.Camera, Group.Motion];

function fieldOf(key: string, prop: JsonProp): Field | null {
  if (!prop.control) {
    return null;
  }

  return {
    key,
    label: prop.label ?? key,
    group: prop.group ?? Group.Content,
    control: prop.control,
    min: prop.minimum,
    max: prop.maximum,
    step: prop.step,
    options: prop.enum,
    assetKind: prop.assetKind,
    fallback: prop.default
  };
}

const cache = new Map<ComponentId, Field[]>();

export function fieldsOf(id: ComponentId): Field[] {
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }

  const json = z.toJSONSchema(COMPONENTS[id].schema, { io: 'input' }) as { properties: Record<string, JsonProp> };
  const fields = Object.entries(json.properties)
    .map(([key, prop]) => fieldOf(key, prop))
    .filter((f): f is Field => f !== null)
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));

  cache.set(id, fields);
  return fields;
}

export function fieldGroups(id: ComponentId): { group: Group; fields: Field[] }[] {
  const fields = fieldsOf(id);
  return GROUP_ORDER.map((group) => ({ group, fields: fields.filter((f) => f.group === group) })).filter((g) => g.fields.length > 0);
}

const SECONDS_PRECISION = 100;

export function secondsLabel(frames: number): string {
  return String(Math.round((frames / FPS) * SECONDS_PRECISION) / SECONDS_PRECISION);
}

export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

type Placed = Animated & { from: number };

export function valueAt(clip: Placed, key: string, frame: number, resolve: (color: string) => string): KeyValue | null {
  const track = clip.keyframes[key];
  if (!track?.length) {
    return baseValue(clip, key);
  }
  const local = frame - clip.from;
  return animProp(clip.component, key)?.kind === ValueKind.Color ? sampleColor(track, local, resolve) : sampleTrack(track, local);
}

export function keyedField(component: ComponentId, key: string): boolean {
  return animProp(component, key)?.source === Source.Prop;
}

export function keyAt(clip: Placed, key: string, frame: number): boolean {
  return (clip.keyframes[key] ?? []).some((k) => k.frame === frame - clip.from);
}

const EDIT_BASE: Record<Source, (doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, local: number) => OpResult> = {
  [Source.Transform]: (doc, clip, key, value) => setTransform(doc, clip.id, { [key]: Number(value) }),
  [Source.Prop]: (doc, clip, key, value) => setProps(doc, clip.id, { [key]: value }),
  [Source.Scene]: (doc, clip, key, value, local) => setKeyframe(doc, clip.id, key, local, value),
  [Source.Mask]: (doc, clip, key, value) => (clip.mask ? setMask(doc, clip.id, { ...clip.mask, [MASK_PROPS[key as MaskKey].field]: Number(value) }) : { ok: false, error: 'add a mask first' })
};

export function editAt(doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, frame: number): OpResult {
  const prop = animProp(clip.component, key);
  if (!prop) {
    return { ok: false, error: `${clip.component} cannot animate ${key}` };
  }
  const local = frame - clip.from;
  if (clip.keyframes[key]?.length) {
    return setKeyframe(doc, clip.id, key, local, value);
  }
  return EDIT_BASE[prop.source](doc, clip, key, value, local);
}

export function toggleKey(doc: MotionDoc, clip: MotionClip, key: string, frame: number, resolve: (color: string) => string): OpResult {
  const local = frame - clip.from;
  if (keyAt(clip, key, frame)) {
    return removeKeyframes(doc, clip.id, key, [local]);
  }
  const value = valueAt(clip, key, frame, resolve);
  if (value === null) {
    return { ok: false, error: `${clip.component} cannot animate ${key}` };
  }
  return setKeyframe(doc, clip.id, key, local, value);
}
