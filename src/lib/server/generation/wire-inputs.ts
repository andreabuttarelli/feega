import type { GenParams } from '$lib/canvas/gen-node';
import type { WireFields } from '$lib/server/canvas/task-provider';

const CONTROLLED_SCHEMA_KEYS = new Set(['aspect_ratio', 'resolution', 'duration']);

export type WireInput = { prompt: string; params: GenParams; imageUrls: string[]; lastFrameUrl: string | null; videoUrls?: string[]; audioUrls?: string[] };

export type ListCaps = Readonly<Partial<Record<'image' | 'video' | 'audio', number>>>;

export type WireShape = { fields: WireFields; fixed?: Readonly<Record<string, string>>; maxRefs?: unknown; caps?: ListCaps };

type Control = { wireId: string | undefined; schemaKey: string; value: unknown; fit: (value: string, allowed: string[]) => string | undefined };

const exactly = (value: string, allowed: string[]): string | undefined => (allowed.includes(value) ? value : undefined);

function nearest(value: string, allowed: string[]): string | undefined {
  const target = Number(value);
  const numeric = allowed.map(Number).filter(Number.isFinite);
  if (!Number.isFinite(target) || !numeric.length) {
    return exactly(value, allowed);
  }
  return String(numeric.reduce((best, n) => (Math.abs(n - target) < Math.abs(best - target) ? n : best)));
}

function allowedOf(schema: Record<string, unknown>, key: string): string[] | null {
  const values = (schema[key] as { values?: unknown } | undefined)?.values;
  return Array.isArray(values) && values.length ? values.map(String) : null;
}

function fitted(control: Control, schema: Record<string, unknown>): string | undefined {
  if (control.value === undefined || control.value === null || control.value === '') {
    return undefined;
  }
  const value = String(control.value);
  const allowed = allowedOf(schema, control.schemaKey);
  return allowed ? control.fit(value, allowed) : value;
}

function extraInputs(params: GenParams, schema: Record<string, unknown>): Record<string, unknown> {
  const raw = params as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(schema)
      .filter((key) => !CONTROLLED_SCHEMA_KEYS.has(key) && raw[key] !== undefined)
      .flatMap((key) => {
        const value = String(raw[key]);
        const allowed = allowedOf(schema, key);
        return !allowed || allowed.includes(value) ? [[key, value]] : [];
      })
  );
}

function capOf(value: unknown): number {
  const cap = Number(value);
  return Number.isFinite(cap) && cap > 0 ? cap : Infinity;
}

function listsOf(shape: WireShape, input: WireInput): Array<[string | undefined, string[], number]> {
  const { fields, caps } = shape;
  return [
    [fields.imageList, input.imageUrls, capOf(caps?.image ?? shape.maxRefs)],
    [fields.videoList, input.videoUrls ?? [], capOf(caps?.video)],
    [fields.audioList, input.audioUrls ?? [], capOf(caps?.audio)]
  ];
}

export function wireInputs(shape: WireShape, input: WireInput, schema: Record<string, unknown>): Record<string, unknown> {
  const { fields } = shape;
  const inputs: Record<string, unknown> = { ...shape.fixed, ...extraInputs(input.params, schema), ...(fields.prompt ? { [fields.prompt]: input.prompt } : {}) };
  const controls: Control[] = [
    { wireId: fields.aspectRatio, schemaKey: 'aspect_ratio', value: input.params.aspectRatio, fit: exactly },
    { wireId: fields.resolution, schemaKey: 'resolution', value: input.params.resolution, fit: exactly },
    { wireId: fields.duration, schemaKey: 'duration', value: input.params.duration, fit: nearest }
  ];
  for (const control of controls) {
    const value = control.wireId ? fitted(control, schema) : undefined;
    if (control.wireId && value !== undefined) {
      inputs[control.wireId] = value;
    }
  }
  fields.images.forEach((wireId, index) => {
    if (input.imageUrls[index]) {
      inputs[wireId] = input.imageUrls[index];
    }
  });
  for (const [wireId, urls, cap] of listsOf(shape, input)) {
    if (wireId && urls.length) {
      inputs[wireId] = urls.slice(0, cap);
    }
  }
  if (fields.video && input.videoUrls?.length) {
    inputs[fields.video] = input.videoUrls[0];
  }
  if (fields.lastFrame && input.lastFrameUrl) {
    inputs[fields.lastFrame] = input.lastFrameUrl;
  }
  return inputs;
}
