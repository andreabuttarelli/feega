import type { CommonProperties, CommonValue } from './common-properties';
import type { ModelChoice } from './gen-node';
import type { ModelParam } from './model-params';

export const SEGMENTED_MAX_OPTIONS = 4;
export const SLIDER_MAX_SPAN = 1000;
export const SUMMARY_SEPARATOR = ' · ';
export const MIXED_LABEL = 'Mixed';
export const DEFAULT_LABEL = 'Auto';

export type ControlSection = 'output' | 'advanced';

export type ControlKind = 'segmented' | 'menu' | 'ratio' | 'chips' | 'switch' | 'slider' | 'number';

export type ControlOption = { value: string; label: string };

export type ControlValue = string | number | boolean | null;

type FieldTarget = 'aspectRatio' | 'duration' | 'resolution' | 'audio' | 'enhancePrompt';

export type ControlTarget = { field: FieldTarget } | { param: string };

export type NodeControl = {
  id: string;
  label: string;
  section: ControlSection;
  kind: ControlKind;
  valueType: 'string' | 'number' | 'boolean';
  options: ControlOption[];
  min?: number;
  max?: number;
  value: ControlValue;
  mixed: boolean;
  target: ControlTarget;
};

export type SelectionPatch = {
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  audio?: boolean;
  enhancePrompt?: boolean;
  dynamicParams?: Record<string, unknown>;
};

export function enumKindOf(count: number): 'segmented' | 'menu' {
  return count <= SEGMENTED_MAX_OPTIONS ? 'segmented' : 'menu';
}

export function numberKindOf(min: number | undefined, max: number | undefined): 'slider' | 'number' {
  if (min === undefined || max === undefined) {
    return 'number';
  }
  return max - min <= SLIDER_MAX_SPAN ? 'slider' : 'number';
}

const PARAM_SECTION: Readonly<Record<string, ControlSection>> = {
  quality: 'output',
  background: 'output',
  style: 'output',
  pipeline_type: 'output',
  generate_texture: 'output'
};

function optionsOf(values: readonly string[], labels: Readonly<Record<string, string>> = {}): ControlOption[] {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

function current<T>(v: CommonValue<T>, fallback: T | null): { value: T | null; mixed: boolean } {
  if (v.kind === 'mixed') {
    return { value: null, mixed: true };
  }
  return { value: v.kind === 'same' ? v.value : fallback, mixed: false };
}

type FieldRow = {
  id: FieldTarget;
  label: string;
  section: ControlSection;
  build: (p: CommonProperties, c: ModelChoice) => Omit<NodeControl, 'id' | 'label' | 'section' | 'target'> | null;
};

const FIELD_ROWS: readonly FieldRow[] = [
  {
    id: 'aspectRatio',
    label: 'Aspect ratio',
    section: 'output',
    build: (p, c) =>
      p.aspectRatio.kind === 'absent' || !c.aspectRatios.length
        ? null
        : { kind: 'ratio', valueType: 'string', options: optionsOf(c.aspectRatios), ...current(p.aspectRatio, null) }
  },
  {
    id: 'duration',
    label: 'Duration',
    section: 'output',
    build: (p, c) => {
      const steps = c.durationOptions ?? [];
      if (p.duration.kind === 'absent' || !steps.length) {
        return null;
      }
      return {
        kind: enumKindOf(steps.length),
        valueType: 'number',
        options: steps.map((s) => ({ value: String(s), label: `${s}s` })),
        ...current(p.duration, steps[0])
      };
    }
  },
  {
    id: 'resolution',
    label: 'Resolution',
    section: 'output',
    build: (p, c) => {
      const options = c.resolutions ?? [];
      if (p.resolution.kind === 'absent' || options.length < 2) {
        return null;
      }
      const kind = enumKindOf(options.length) === 'segmented' ? 'chips' : 'menu';
      return { kind, valueType: 'string', options: optionsOf(options), ...current(p.resolution, options[0]) };
    }
  },
  {
    id: 'audio',
    label: 'Audio',
    section: 'output',
    build: (p, c) =>
      p.audio.kind === 'absent' || c.generateAudio === undefined
        ? null
        : { kind: 'switch', valueType: 'boolean', options: [], ...current(p.audio, c.generateAudio) }
  },
  {
    id: 'enhancePrompt',
    label: 'Enhance prompt',
    section: 'advanced',
    build: (p) =>
      p.enhancePrompt.kind === 'absent'
        ? null
        : { kind: 'switch', valueType: 'boolean', options: [], ...current(p.enhancePrompt, false) }
  }
];

function paramControlOf(param: ModelParam, value: CommonValue<unknown> | undefined): NodeControl {
  const common = value ?? { kind: 'unset' };
  const base = {
    id: param.name,
    label: param.label,
    section: PARAM_SECTION[param.name] ?? 'advanced',
    target: { param: param.name }
  } as const;

  if (param.kind === 'enum') {
    return { ...base, kind: enumKindOf(param.values.length), valueType: 'string', options: optionsOf(param.values, param.optionLabels), ...current(common as CommonValue<string>, param.values[0]) };
  }
  if (param.kind === 'boolean') {
    return { ...base, kind: 'switch', valueType: 'boolean', options: [], ...current(common as CommonValue<boolean>, false) };
  }
  return {
    ...base,
    kind: numberKindOf(param.min, param.max),
    valueType: 'number',
    options: [],
    min: param.min,
    max: param.max,
    ...current(common as CommonValue<number>, param.min ?? null)
  };
}

export function nodeControlsOf(
  properties: CommonProperties,
  choice: ModelChoice | null | undefined,
  dynamicValues: Record<string, CommonValue<unknown>>
): NodeControl[] {
  if (!choice) {
    return [];
  }

  const fields = FIELD_ROWS.flatMap((row) => {
    const built = row.build(properties, choice);
    return built ? [{ ...built, id: row.id, label: row.label, section: row.section, target: { field: row.id } } as NodeControl] : [];
  });
  const params = (choice.params ?? []).map((param) => paramControlOf(param, dynamicValues[param.name]));
  const all = [...fields, ...params];

  return [...all.filter((c) => c.section === 'output'), ...all.filter((c) => c.section === 'advanced')];
}

function coerce(control: NodeControl, value: ControlValue): string | number | boolean {
  if (control.valueType === 'number') {
    return Number(value);
  }
  if (control.valueType === 'boolean') {
    return Boolean(value);
  }
  return String(value);
}

export function patchOf(control: NodeControl, value: ControlValue): SelectionPatch {
  const coerced = coerce(control, value);

  if ('field' in control.target) {
    return { [control.target.field]: coerced };
  }
  return { dynamicParams: { [control.target.param]: coerced } };
}

export function displayOf(control: NodeControl): string {
  if (control.mixed) {
    return MIXED_LABEL;
  }
  if (control.value === null) {
    return DEFAULT_LABEL;
  }
  if (control.kind === 'switch') {
    return `${control.label} ${control.value ? 'on' : 'off'}`;
  }
  return control.options.find((o) => o.value === String(control.value))?.label ?? String(control.value);
}

function summaryPartOf(control: NodeControl): string {
  const shown = displayOf(control);
  return 'param' in control.target && control.kind !== 'switch' ? `${control.label} ${shown}` : shown;
}

function summarised(control: NodeControl): boolean {
  return control.section === 'output' && !(control.kind === 'switch' && control.value === true && !control.mixed);
}

export function summaryOf(controls: NodeControl[]): string {
  return controls.filter(summarised).map(summaryPartOf).join(SUMMARY_SEPARATOR);
}
