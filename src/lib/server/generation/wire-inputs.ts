import type { GenParams } from '$lib/canvas/gen-node';
import type { WireFields } from '$lib/server/canvas/task-provider';

const CONTROLLED_SCHEMA_KEYS = new Set(['aspect_ratio', 'resolution', 'duration']);

export type WireInput = { prompt: string; params: GenParams; imageUrls: string[]; lastFrameUrl: string | null };

function extraInputs(params: GenParams, schema: Record<string, unknown>): Record<string, unknown> {
  const raw = params as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(schema)
      .filter((key) => !CONTROLLED_SCHEMA_KEYS.has(key) && raw[key] !== undefined)
      .map((key) => [key, String(raw[key])])
  );
}

export function wireInputs(fields: WireFields, input: WireInput, schema: Record<string, unknown>): Record<string, unknown> {
  const inputs: Record<string, unknown> = { ...extraInputs(input.params, schema), ...(fields.prompt ? { [fields.prompt]: input.prompt } : {}) };
  const controls: Array<[string | undefined, unknown]> = [
    [fields.aspectRatio, input.params.aspectRatio],
    [fields.resolution, input.params.resolution],
    [fields.duration, input.params.duration]
  ];
  for (const [wireId, value] of controls) {
    if (wireId && value !== undefined && value !== null && value !== '') {
      inputs[wireId] = String(value);
    }
  }
  fields.images.forEach((wireId, index) => {
    if (input.imageUrls[index]) {
      inputs[wireId] = input.imageUrls[index];
    }
  });
  if (fields.imageList && input.imageUrls.length) {
    inputs[fields.imageList] = input.imageUrls;
  }
  if (fields.lastFrame && input.lastFrameUrl) {
    inputs[fields.lastFrame] = input.lastFrameUrl;
  }
  return inputs;
}
