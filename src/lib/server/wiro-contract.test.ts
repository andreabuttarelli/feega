import { describe, expect, it } from 'vitest';
import snapshot from './wiro-catalogue.contract.fixture.json';
import { wiroModelRow, type WiroTool } from './wiro-catalogue';
import { taskChoice, wireSpecOf } from './task-choice';
import { wireInputs } from './generation/wire-inputs';
import { defaultParamsFor, type GenParams, type ModelChoice } from '$lib/canvas/gen-node';
import type { TaskWireSpec } from './canvas/task-run';

const SYNCED = '2026-10-15T00:00:00.000Z';
const IMAGE = 'https://cdn.example.com/ref.png';
const FILE_TYPES = /fileinput/;

type Param = { id: string; type: string; required?: boolean; value?: unknown; options?: Array<{ value?: unknown }> };

const tools = snapshot.tool as unknown as WiroTool[];

function paramsOf(tool: WiroTool): Param[] {
  return (tool.parameters ?? []).flatMap((group) => (group.items ?? []) as Param[]);
}

function violations(tool: WiroTool, inputs: Record<string, unknown>): string[] {
  const params = paramsOf(tool);
  const byId = new Map(params.map((p) => [p.id, p]));
  const errors: string[] = [];
  for (const [key, value] of Object.entries(inputs)) {
    const param = byId.get(key);
    if (!param) {
      errors.push(`unknown field ${key}`);
      continue;
    }
    const options = (param.options ?? []).map((o) => String(o.value ?? ''));
    if (param.type === 'select' && options.length && !options.includes(String(value))) {
      errors.push(`${key}=${String(value)} not in [${options.join(',')}]`);
    }
  }
  for (const param of params.filter((p) => p.required && !FILE_TYPES.test(p.type))) {
    if (inputs[param.id] === undefined || inputs[param.id] === '') {
      errors.push(`required ${param.id} missing`);
    }
  }
  return errors;
}

type NodeState = { label: string; params: GenParams; imageUrls: string[]; lastFrameUrl: string | null };

function states(choice: ModelChoice, spec: TaskWireSpec): NodeState[] {
  const base = defaultParamsFor(choice);
  const images = spec.requiresImage ? [IMAGE] : [];
  const dynamic = Object.fromEntries((choice.params ?? []).flatMap((p) => (p.kind === 'enum' ? [[p.name, p.values.at(-1)]] : [])));
  const all: NodeState[] = [
    { label: 'fresh node', params: base, imageUrls: images, lastFrameUrl: null },
    { label: 'stale params from another model', params: { aspectRatio: '7:3', resolution: 'bogus', duration: 999 }, imageUrls: images, lastFrameUrl: null },
    { label: 'dynamic params', params: { ...base, ...dynamic }, imageUrls: images, lastFrameUrl: null },
    ...choice.aspectRatios.map((aspectRatio) => ({ label: `aspect ${aspectRatio}`, params: { ...base, aspectRatio }, imageUrls: images, lastFrameUrl: null })),
    ...(choice.durationOptions ?? []).map((duration) => ({ label: `duration ${duration}`, params: { ...base, duration }, imageUrls: images, lastFrameUrl: null })),
    ...(choice.resolutions ?? []).map((resolution) => ({ label: `resolution ${resolution}`, params: { ...base, resolution }, imageUrls: images, lastFrameUrl: null }))
  ];
  if (choice.maxRefs) {
    all.push({ label: 'every reference slot filled', params: base, imageUrls: Array(choice.maxRefs + 2).fill(IMAGE), lastFrameUrl: spec.fields.lastFrame ? IMAGE : null });
  }
  return all;
}

const rows = tools.map((tool) => ({ tool, row: wiroModelRow(tool, SYNCED) })).filter((entry) => entry.row);
const offered = rows.filter((entry) => !wireSpecOf(entry.row!.wire_spec)?.unrunnable);

describe('every offered Wiro model sends a request its published schema accepts', () => {
  it.each(offered.map((entry) => [entry.row!.id, entry] as const))('%s', (_id, { tool, row }) => {
    const choice = taskChoice(row!);
    const spec = wireSpecOf(row!.wire_spec)!;
    const failures = states(choice, spec).flatMap((state) =>
      violations(tool, wireInputs(spec, { prompt: 'a lake at dawn', ...state }, row!.param_schema ?? {})).map((v) => `${state.label}: ${v}`)
    );
    expect(failures).toEqual([]);
  });
});

describe('the node never offers what the model cannot take', () => {
  it.each(offered.map((entry) => [entry.row!.id, entry] as const))('%s', (_id, { row }) => {
    const choice = taskChoice(row!);
    const schema = (row!.param_schema ?? {}) as Record<string, { values?: string[] }>;
    if (schema.aspect_ratio?.values?.length) {
      expect(schema.aspect_ratio.values).toEqual(expect.arrayContaining(choice.aspectRatios));
    }
    for (const duration of choice.durationOptions ?? []) {
      expect(schema.duration?.values).toContain(String(duration));
    }
    if (row!.uncensored) {
      expect(choice.maxRefs).toBe(0);
      expect(choice.inputModalities).not.toContain('image');
    }
  });
});

describe('a Wiro model nobody can run is never offered', () => {
  const unrunnable = (slug: string) => wireSpecOf(rows.find((entry) => entry.row!.id === `wiro/${slug}`)!.row!.wire_spec)?.unrunnable;

  it('a required field without a default', () => {
    expect(unrunnable('wiro/text-to-image-sana')).toBeTruthy();
    expect(unrunnable('wiro/train-flux-lora')).toBeTruthy();
  });

  it('an uncensored model that requires an image, which uncensored runs never carry', () => {
    expect(unrunnable('wiro-partners/wan-2-7-uncensored')).toBeTruthy();
    expect(unrunnable('wiro-partners/qwen-image-edit-uncensored')).toBeTruthy();
  });

  it('an edit model that requires an image says so', () => {
    const row = rows.find((entry) => entry.row!.id === 'wiro/fireredteam/firered-image-edit')!.row!;
    expect(wireSpecOf(row.wire_spec)).toMatchObject({ requiresImage: true });
    expect(wireSpecOf(row.wire_spec)?.unrunnable).toBeUndefined();
  });
});
