import type { ComponentExample } from '../host/component-examples';
import type { ComponentRow } from '../host/component-list';
import { Badge, type Control, type Controls } from './canvas-card';

export type Edits = Record<string, Record<string, unknown>>;

export type Chosen = Record<string, string>;

export type SavedComponents = Record<string, { example?: string; props?: Record<string, unknown> }>;

export enum FieldKind {
  Text = 'text',
  Number = 'number',
  Toggle = 'toggle',
  Json = 'json'
}

export type Field = { name: string; kind: FieldKind; value: string; edited: boolean };

const KIND_OF: Record<string, FieldKind> = { number: FieldKind.Number, toggle: FieldKind.Toggle, array: FieldKind.Json, object: FieldKind.Json };
const JSON_START = /^\s*[{[]/;
const NOT_A_FIELD = new Set(['children', 'callback']);
const PLACEHOLDER: Record<FieldKind, (name: string) => unknown> = {
  [FieldKind.Text]: (name) => name,
  [FieldKind.Number]: () => 0,
  [FieldKind.Toggle]: () => false,
  [FieldKind.Json]: () => null
};
const EMPTY_JSON: Record<string, unknown> = { array: [], object: {} };

export function bestExample(row: ComponentRow, chosen: string | undefined): ComponentExample | null {
  const picked = row.examples.find((example) => example.id === chosen);

  return picked ?? row.examples.reduce<ComponentExample | null>((best, next) => (best === null || next.unresolved.length < best.unresolved.length ? next : best), null);
}

export const propsFor = (row: ComponentRow, chosen: string | undefined, edits: Record<string, unknown>): Record<string, unknown> => ({ ...bestExample(row, chosen)?.props, ...edits });

export function displayOf(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function parseField(text: string, kind: FieldKind): unknown {
  if (kind === FieldKind.Toggle) {
    return text === 'true';
  }
  if (kind === FieldKind.Number) {
    return text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
  }
  const looksLikeJson = kind === FieldKind.Json || JSON_START.test(text);
  if (!looksLikeJson) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const kindOf = (control: Control | undefined): FieldKind => KIND_OF[control?.kind ?? ''] ?? FieldKind.Text;

function placeholderOf(control: Control | undefined, name: string): unknown {
  if (control?.default !== undefined) {
    return control.default;
  }
  const kind = kindOf(control);

  return kind === FieldKind.Json ? (EMPTY_JSON[control?.kind ?? ''] ?? []) : (control?.options?.[0] ?? PLACEHOLDER[kind](name));
}

export function fieldsOf(row: ComponentRow, chosen: string | undefined, edits: Record<string, unknown>, controls: Controls): Field[] {
  const example = bestExample(row, chosen);
  const declared = (controls ?? []).filter((control) => !NOT_A_FIELD.has(control.kind)).map((control) => control.name);
  const open = example ? example.unresolved : declared;
  const names = [...new Set([...open, ...Object.keys(edits)])];

  return names.map((name) => {
    const control = controls?.find((c) => c.name === name);
    const edited = name in edits;
    const value = edited ? edits[name] : (example?.props[name] ?? placeholderOf(control, name));

    return { name, kind: kindOf(control), value: displayOf(value), edited };
  });
}

export function badgeOf(row: ComponentRow, chosen: string | undefined, edits: Record<string, unknown>, shown: Record<string, unknown> | undefined): Badge | null {
  if (Object.keys(edits).length > 0) {
    return Badge.Edited;
  }
  if (Object.keys(bestExample(row, chosen)?.props ?? {}).length > 0) {
    return Badge.Code;
  }

  return shown && Object.keys(shown).length > 0 ? Badge.Sample : null;
}

export function withEdit(edits: Edits, key: string, name: string, value: unknown): Edits {
  const { [key]: current = {}, ...rest } = edits;
  const { [name]: _dropped, ...kept } = current;
  const next = value === undefined ? kept : { ...kept, [name]: value };

  return Object.keys(next).length === 0 ? rest : { ...rest, [key]: next };
}

export function savedOf(chosen: Chosen, edits: Edits): SavedComponents {
  const out: SavedComponents = {};
  for (const [key, example] of Object.entries(chosen)) {
    out[key] = { ...out[key], example };
  }
  for (const [key, props] of Object.entries(edits)) {
    out[key] = { ...out[key], props };
  }

  return out;
}

export function loadedFrom(saved: SavedComponents | undefined): { chosen: Chosen; edits: Edits } {
  const entries = Object.entries(saved ?? {});

  return {
    chosen: Object.fromEntries(entries.flatMap(([key, value]) => (value.example ? [[key, value.example]] : []))),
    edits: Object.fromEntries(entries.flatMap(([key, value]) => (value.props ? [[key, value.props]] : [])))
  };
}
