import { offsetOf } from '@feega/live-edit/class-patch';
import { elementRange } from '@feega/live-edit/element-range';
import { Delimiter, attributesOf } from '@feega/live-edit/open-tag';
import { Control, type Source, type UiNode } from '@feega/plugin-api/protocol';

export const TAGS = ['ShaderGradient', 'ShaderGradientBackground'];

enum Kind {
  Colour,
  Number,
  Switch,
  Choice
}

type Spec = { id: string; label: string; kind: Kind; fallback: string; min?: number; max?: number; step?: number; options?: string[] };

const ON = 'on';
const OFF = 'off';

export const SPECS: Spec[] = [
  { id: 'type', label: 'Type', kind: Kind.Choice, fallback: 'plane', options: ['plane', 'sphere', 'waterPlane'] },
  { id: 'color1', label: 'Colour 1', kind: Kind.Colour, fallback: '#ff5005' },
  { id: 'color2', label: 'Colour 2', kind: Kind.Colour, fallback: '#dbba95' },
  { id: 'color3', label: 'Colour 3', kind: Kind.Colour, fallback: '#d0bce1' },
  { id: 'animate', label: 'Animate', kind: Kind.Switch, fallback: ON },
  { id: 'uSpeed', label: 'Speed', kind: Kind.Number, fallback: '0.2', min: 0, max: 2, step: 0.05 },
  { id: 'uStrength', label: 'Strength', kind: Kind.Number, fallback: '4', min: 0, max: 10, step: 0.1 },
  { id: 'uDensity', label: 'Density', kind: Kind.Number, fallback: '1.3', min: 0, max: 10, step: 0.1 },
  { id: 'uFrequency', label: 'Frequency', kind: Kind.Number, fallback: '5.5', min: 0, max: 10, step: 0.1 },
  { id: 'brightness', label: 'Brightness', kind: Kind.Number, fallback: '1.2', min: 0, max: 2, step: 0.05 },
  { id: 'grain', label: 'Grain', kind: Kind.Switch, fallback: OFF },
  { id: 'lightType', label: 'Light', kind: Kind.Choice, fallback: '3d', options: ['3d', 'env'] },
  { id: 'cAzimuthAngle', label: 'Camera azimuth', kind: Kind.Number, fallback: '180', min: 0, max: 360, step: 1 },
  { id: 'cPolarAngle', label: 'Camera polar', kind: Kind.Number, fallback: '90', min: 0, max: 180, step: 1 },
  { id: 'cDistance', label: 'Camera distance', kind: Kind.Number, fallback: '3.6', min: 0, max: 10, step: 0.1 },
  { id: 'cameraZoom', label: 'Camera zoom', kind: Kind.Number, fallback: '1', min: 1, max: 40, step: 0.5 },
  { id: 'rotationX', label: 'Rotation X', kind: Kind.Number, fallback: '0', min: 0, max: 360, step: 1 },
  { id: 'rotationY', label: 'Rotation Y', kind: Kind.Number, fallback: '10', min: 0, max: 360, step: 1 },
  { id: 'rotationZ', label: 'Rotation Z', kind: Kind.Number, fallback: '50', min: 0, max: 360, step: 1 }
];

export const defaultAttributes = () =>
  SPECS.map((spec) => (spec.kind === Kind.Number ? `${spec.id}={${spec.fallback}}` : `${spec.id}="${spec.fallback}"`)).join(' ');

export type Gradient = { tag: string; values: Record<string, string>; bound: string[] };

const PLAIN_VALUE = /^\s*(?:(['"`])([^'"`$\\]*)\1|(-?\d+(?:\.\d+)?))\s*$/;

function literalOf(attribute: { value: string | null; delimiter: Delimiter }): string | null {
  if (attribute.delimiter === Delimiter.Shorthand || attribute.value === null) {
    return null;
  }
  if (attribute.delimiter !== Delimiter.Brace) {
    return attribute.value;
  }
  const plain = attribute.value.match(PLAIN_VALUE);
  return plain ? (plain[2] ?? plain[3]) : null;
}

export function gradientAt(text: string, at: Source): Gradient | null {
  const start = offsetOf(text, at);
  const range = start < 0 ? null : elementRange(text, start);
  if (!range) {
    return null;
  }
  const inside = text.slice(range.openEnd + 1, range.closeStart);
  const pattern = new RegExp(`<(${TAGS.join('|')})(?=[\\s/>])`);
  const found = pattern.exec(inside);
  if (!found) {
    return null;
  }
  const tagStart = range.openEnd + 1 + found.index;
  const values: Record<string, string> = {};
  const bound: string[] = [];
  for (const attribute of attributesOf(text, tagStart)) {
    const value = literalOf(attribute);
    if (value === null) {
      bound.push(attribute.name);
      continue;
    }
    values[attribute.name] = value;
  }
  return { tag: found[1], values, bound: bound.filter((name) => SPECS.some((spec) => spec.id === name)) };
}

const options = (values: string[]) => values.map((value) => ({ value, label: value }));

function nodeOf(spec: Spec, value: string): UiNode {
  const { id, label } = spec;
  if (spec.kind === Kind.Colour) {
    return { type: Control.Colour, id, label, value };
  }
  if (spec.kind === Kind.Switch) {
    return { type: Control.Toggle, id, label, value: value === ON };
  }
  if (spec.kind === Kind.Choice) {
    return { type: Control.Select, id, label, value, options: options(spec.options ?? []) };
  }
  return { type: Control.Slider, id, label, min: spec.min ?? 0, max: spec.max ?? 1, step: spec.step ?? 1, value: Number(value) };
}

export function treeOf(gradient: Gradient): UiNode[] {
  const nodes = SPECS.filter((spec) => !gradient.bound.includes(spec.id)).map((spec) => nodeOf(spec, gradient.values[spec.id] ?? spec.fallback));
  const note: UiNode[] = gradient.bound.length ? [{ type: Control.Note, text: `${gradient.bound.join(', ')} come from code: edit them there.` }] : [];
  return [...nodes, ...note];
}

export type Write = { set: Record<string, string>; numbers: Record<string, number> };

export function writeOf(id: string, value: string | number | boolean): Write | null {
  const spec = SPECS.find((one) => one.id === id);
  if (!spec) {
    return null;
  }
  if (spec.kind === Kind.Number) {
    return { set: {}, numbers: { [id]: Number(value) } };
  }
  return { set: { [id]: spec.kind === Kind.Switch ? (value ? ON : OFF) : String(value) }, numbers: {} };
}
