import { z } from 'zod';
import { COMPONENTS, Control, Group, type AssetKind, type ComponentId } from './components';
import { FPS } from './design';

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
