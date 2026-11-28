import type { Control, Controls } from './canvas-card';

export enum EdgePreset {
  LongText = 'edge:long-text',
  Empty = 'edge:empty',
  MissingImage = 'edge:missing-image',
  ExtremeNumbers = 'edge:extreme-numbers'
}

export type EdgeProps = Record<string, unknown>;

export type EdgeExample = { id: EdgePreset; label: string; props: EdgeProps };

type Rule = { label: string; valueOf: (control: Control, nth: number) => unknown };

export const EDGE_LONG_TEXT_LENGTH = 200;
export const MISSING_IMAGE_URL = 'https://example.invalid/feega-missing.png';

const EXTREME_NUMBERS = [0, -1, 999999];
const IMAGE_NAME = /image|img|src|url|avatar|photo|picture|thumbnail|logo|cover|poster/i;
const FILLER = 'Lorem ipsum dolor sit amet, ';
const NONE = undefined;

const longText = FILLER.repeat(Math.ceil(EDGE_LONG_TEXT_LENGTH / FILLER.length)).slice(0, EDGE_LONG_TEXT_LENGTH);

const EMPTY: Record<string, unknown> = { text: '', array: [] };

const RULES: Record<EdgePreset, Rule> = {
  [EdgePreset.LongText]: { label: 'Long text', valueOf: (c) => (c.kind === 'text' ? longText : NONE) },
  [EdgePreset.Empty]: { label: 'Empty', valueOf: (c) => EMPTY[c.kind] },
  [EdgePreset.MissingImage]: { label: 'Missing image', valueOf: (c) => (c.kind === 'text' && IMAGE_NAME.test(c.name) ? MISSING_IMAGE_URL : NONE) },
  [EdgePreset.ExtremeNumbers]: { label: 'Extreme numbers', valueOf: (c, nth) => (c.kind === 'number' ? EXTREME_NUMBERS[nth % EXTREME_NUMBERS.length] : NONE) }
};

function propsOf(rule: Rule, controls: Controls, base: EdgeProps): EdgeProps {
  const props: EdgeProps = {};

  for (const control of controls ?? []) {
    const value = rule.valueOf(control, Object.keys(props).length);
    if (value !== NONE && JSON.stringify(value) !== JSON.stringify(base[control.name])) {
      props[control.name] = value;
    }
  }

  return props;
}

export function edgePresets(controls: Controls, base: EdgeProps): EdgeExample[] {
  const ids = Object.values(EdgePreset);
  const built = ids.map((id) => ({ id, label: RULES[id].label, props: propsOf(RULES[id], controls, base) }));

  return built.filter((preset) => Object.keys(preset.props).length > 0);
}

export const presetPropsOf = (chosen: string | undefined, controls: Controls, base: EdgeProps): EdgeProps => edgePresets(controls, base).find((p) => p.id === chosen)?.props ?? {};

export const isPreset = (id: string | undefined): boolean => Object.values<string>(EdgePreset).includes(id ?? '');
