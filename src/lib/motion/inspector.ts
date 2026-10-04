import { withModifierParam } from './shape/model';
import { modifierOfKey, shapeFieldShown, type Modifier, type ShapeKind } from './shape/schema';
import { z } from 'zod';
import { AssetKind, COMPONENTS, Control, Group, type ComponentId } from './components';
import { FPS } from './design';
import { Source, ValueKind, animProp, baseValue, sampleColor, sampleTrack, type AnimProp, type Animated, type KeyValue } from './keyframes';
import type { MotionClip, MotionDoc } from './doc';
import { MASK_PROPS, type MaskKey } from './mask';
import { removeKeyframes, setKeyframe, setMask, setProps, setTransform, type OpResult } from './timeline';
import { PropFormat, type PropSpec, type PropsSchema } from './custom/component';
import { withParams } from './custom/params';
import { effectOfKey } from './effects/model';
import { setEffect } from './effects/ops';
import { SELECTOR, animatorOfKey } from './text-animators/model';
import { setAnimator } from './text-animators/ops';

export enum InspectorTab {
  Properties = 'properties',
  Code = 'code'
}

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

const RANGE_FALLBACK_MAX = 100;

const FORMAT_CONTROL: Record<PropFormat, Control> = {
  [PropFormat.Color]: Control.Color,
  [PropFormat.Textarea]: Control.Textarea,
  [PropFormat.Asset]: Control.Asset,
  [PropFormat.Font]: Control.Font
};

const TYPE_CONTROL: Record<PropSpec['type'], (spec: PropSpec) => Control> = {
  string: (spec) => (spec.format ? FORMAT_CONTROL[spec.format] : spec.enum ? Control.Select : Control.Text),
  number: () => Control.Range,
  boolean: () => Control.Toggle
};

export function customFields(schema: PropsSchema): Field[] {
  return Object.entries(schema.properties).map(([key, spec]) => {
    const control = TYPE_CONTROL[spec.type](spec);
    const fallback = spec.default;
    return {
      key,
      label: spec.title ?? key,
      group: (spec.group as Group | undefined) ?? Group.Content,
      control,
      min: spec.type === 'number' ? (spec.minimum ?? 0) : undefined,
      max: spec.type === 'number' ? (spec.maximum ?? Math.max(RANGE_FALLBACK_MAX, Number(fallback ?? 0) * 4)) : undefined,
      step: spec.type === 'number' ? (spec.step ?? 1) : undefined,
      options: spec.enum,
      assetKind: control === Control.Asset ? ((spec.assetKind as AssetKind | undefined) ?? AssetKind.Image) : undefined,
      fallback
    };
  });
}

export function clipFieldGroups(doc: MotionDoc, clip: MotionClip): { group: Group; fields: Field[] }[] {
  if (clip.component === 'Shape') {
    const kind = clip.props.shape as ShapeKind;
    return fieldGroups('Shape').map((g) => ({ ...g, fields: g.fields.filter((f) => shapeFieldShown(kind, f.key)) }));
  }
  if (clip.component !== 'Custom') {
    return fieldGroups(clip.component);
  }
  const component = doc.components[String(clip.props.name)];
  const fields = component ? customFields(component.propsSchema) : [];
  return GROUP_ORDER.map((group) => ({ group, fields: fields.filter((f) => f.group === group) })).filter((g) => g.fields.length > 0);
}

const SECONDS_PRECISION = 100;

export function secondsLabel(frames: number, fps: number = FPS): string {
  return String(Math.round((frames / fps) * SECONDS_PRECISION) / SECONDS_PRECISION);
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
  return animProp(clip.component, key, clip.params)?.kind === ValueKind.Color ? sampleColor(track, local, resolve) : sampleTrack(track, local);
}

const KEYED_SOURCES: ReadonlySet<Source> = new Set([Source.Prop, Source.Param, Source.Sound]);

export function keyedField(component: ComponentId, key: string, params: readonly AnimProp[] = []): boolean {
  const source = animProp(component, key, params)?.source;
  return source !== undefined && KEYED_SOURCES.has(source);
}

export function keyAt(clip: Placed, key: string, frame: number): boolean {
  return (clip.keyframes[key] ?? []).some((k) => k.frame === frame - clip.from);
}

const EDIT_BASE: Record<Source, (doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, local: number) => OpResult> = {
  [Source.Transform]: (doc, clip, key, value) => setTransform(doc, clip.id, { [key]: Number(value) }),
  [Source.Prop]: (doc, clip, key, value) => setProps(doc, clip.id, { [key]: value }),
  [Source.Scene]: (doc, clip, key, value, local) => setKeyframe(doc, clip.id, key, local, value),
  [Source.Param]: (doc, clip, key, value) => setProps(doc, clip.id, { [key]: value }),
  [Source.Sound]: (doc, clip, key, value) => setProps(doc, clip.id, { [key]: value }),
  [Source.Effect]: (doc, clip, key, value) => {
    const ref = effectOfKey(key);
    return ref ? setEffect(doc, clip.id, ref.effectId, { params: { [ref.param]: value } }) : { ok: false, error: `no effect for ${key}` };
  },
  [Source.Animator]: (doc, clip, key, value) => {
    const ref = animatorOfKey(key);
    if (!ref) {
      return { ok: false, error: `no text animator for ${key}` };
    }
    const patch = ref.field in SELECTOR ? { [ref.field]: Number(value) } : { values: { [ref.field]: value } };
    return setAnimator(doc, clip.id, ref.id, patch);
  },
  [Source.Modifier]: (doc, clip, key, value) => {
    const ref = modifierOfKey(key);
    const next = ref ? withModifierParam((clip.props.modifiers as Modifier[] | undefined) ?? [], ref.id, ref.param, Number(value)) : `no modifier for ${key}`;
    return typeof next === 'string' ? { ok: false, error: next } : setProps(doc, clip.id, { modifiers: next });
  },
  [Source.Mask]: (doc, clip, key, value) => (clip.mask ? setMask(doc, clip.id, { ...clip.mask, [MASK_PROPS[key as MaskKey].field]: Number(value) }) : { ok: false, error: 'add a mask first' })
};

export function editAt(doc: MotionDoc, clip: MotionClip, key: string, value: KeyValue, frame: number): OpResult {
  const prop = animProp(clip.component, key, withParams(doc, clip).params);
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
  const value = valueAt(withParams(doc, clip), key, frame, resolve);
  if (value === null) {
    return { ok: false, error: `${clip.component} cannot animate ${key}` };
  }
  return setKeyframe(doc, clip.id, key, local, value);
}
