export enum ControlKind {
  Select = 'select',
  Toggle = 'toggle',
  Text = 'text',
  Number = 'number',
  Children = 'children',
  Array = 'array',
  Object = 'object',
  Callback = 'callback',
  Color = 'color',
  Date = 'date',
  Element = 'element'
}

export type Scalar = string | number | boolean;
export type PropValue = Scalar | null | PropValue[] | { [key: string]: PropValue };
export type PropControl = { name: string; kind: ControlKind; required?: boolean; options?: Scalar[]; default?: PropValue };
export type Variant = { label: string; props: Record<string, PropValue> };
export type Variants = { variants: Variant[] | null; dropped: string[]; total: number };

export const VARIANT_CAP = 24;
export const INVALID = Symbol('invalid');

export enum Input {
  Select = 'select',
  Checkbox = 'checkbox',
  Number = 'number',
  Text = 'text',
  Date = 'date',
  Json = 'json',
  Readonly = 'readonly'
}

export type Editor = {
  input: Input;
  readonly?: boolean;
  show: (value: unknown, control: PropControl) => string;
  read: (raw: string, control: PropControl) => PropValue | undefined | typeof INVALID;
  swatch?: (value: unknown) => string;
};

const CHILDREN = 'children';
const HEX = /^#[0-9a-f]{6}$/i;
const SWATCH_FALLBACK = '#000000';
const DATE_MARK = '$date';
const FUNCTION_MARK = '$fn';
const JSX_MARK = '$jsx';
const DATE_LENGTH = 10;
const JSON_INDENT = 2;
const MIDNIGHT = 'T00:00:00.000Z';

const textOf = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const text: Editor = { input: Input.Text, show: textOf, read: (raw) => raw };

function json(isShape: (value: unknown) => boolean): Editor {
  return {
    input: Input.Json,
    show: (value) => (value === undefined ? '' : JSON.stringify(value, null, JSON_INDENT)),
    read: (raw) => {
      if (raw.trim() === '') {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return isShape(parsed) ? parsed : INVALID;
      } catch {
        return INVALID;
      }
    }
  };
}

const isPlainObject = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value);

export const EDITORS: Record<ControlKind, Editor> = {
  [ControlKind.Select]: { input: Input.Select, show: textOf, read: (raw, control) => control.options?.find((option) => String(option) === raw) },
  [ControlKind.Toggle]: { input: Input.Checkbox, show: (value) => String(value === true), read: (raw) => raw === 'true' },
  [ControlKind.Number]: { input: Input.Number, show: textOf, read: (raw) => (raw === '' ? undefined : Number(raw)) },
  [ControlKind.Text]: text,
  [ControlKind.Children]: text,
  [ControlKind.Color]: { ...text, swatch: (value) => (typeof value === 'string' && HEX.test(value) ? value : SWATCH_FALLBACK) },
  [ControlKind.Array]: json(Array.isArray),
  [ControlKind.Object]: json(isPlainObject),
  [ControlKind.Date]: {
    input: Input.Date,
    show: (value) => textOf((value as { $date?: string } | undefined)?.[DATE_MARK]).slice(0, DATE_LENGTH),
    read: (raw) => (raw === '' ? undefined : { [DATE_MARK]: `${raw}${MIDNIGHT}` })
  },
  [ControlKind.Callback]: { input: Input.Readonly, readonly: true, show: () => 'function', read: () => undefined },
  [ControlKind.Element]: { input: Input.Readonly, readonly: true, show: () => 'JSX', read: () => undefined }
};

const isJsx = (value: unknown) => typeof value === 'object' && value !== null && JSX_MARK in value;

export const editorFor = (control: PropControl, value: unknown): Editor => EDITORS[isJsx(value) ? ControlKind.Element : control.kind];

const plainKind = (value: object): ControlKind => (JSX_MARK in value ? ControlKind.Element : FUNCTION_MARK in value ? ControlKind.Callback : DATE_MARK in value ? ControlKind.Date : ControlKind.Object);

const OBSERVED: Record<string, (value: unknown) => ControlKind> = {
  string: () => ControlKind.Text,
  boolean: () => ControlKind.Toggle,
  number: () => ControlKind.Number,
  object: (value) => (Array.isArray(value) ? ControlKind.Array : plainKind(value as object))
};

function observedKind(name: string, value: unknown): ControlKind | null {
  if (name === CHILDREN) {
    return typeof value === 'string' || typeof value === 'number' ? ControlKind.Children : isJsx(value) ? ControlKind.Element : null;
  }
  return value === null ? null : (OBSERVED[typeof value]?.(value) ?? null);
}

export function controlsOf(documented: PropControl[] | null, observed: Record<string, unknown>): PropControl[] {
  const known = new Set((documented ?? []).map((c) => c.name));
  const added = Object.entries(observed).flatMap(([name, value]) => {
    const kind = known.has(name) ? null : observedKind(name, value);
    return kind ? [{ name, kind }] : [];
  });
  return [...(documented ?? []), ...added];
}

const AXES: Partial<Record<ControlKind, (control: PropControl) => PropValue[] | null>> = {
  [ControlKind.Select]: (control) => control.options ?? null,
  [ControlKind.Toggle]: () => [false, true]
};

const axisOf = (control: PropControl): PropValue[] | null => AXES[control.kind]?.(control) ?? null;

export function variantsOf(controls: PropControl[]): Variants {
  const axes = controls.flatMap((control) => {
    const values = axisOf(control);
    return values ? [{ name: control.name, kind: control.kind, values }] : [];
  });
  if (!axes.length) {
    return { variants: null, dropped: [], total: 0 };
  }

  const total = axes.reduce((product, axis) => product * axis.values.length, 1);
  const kept: typeof axes = [];
  let size = 1;
  for (const axis of axes) {
    if (size * axis.values.length <= VARIANT_CAP) {
      kept.push(axis);
      size *= axis.values.length;
    }
  }

  const rows = kept.reduce<Record<string, PropValue>[]>((combos, axis) => combos.flatMap((combo) => axis.values.map((value) => ({ ...combo, [axis.name]: value }))), [{}]);
  const label = (props: Record<string, PropValue>) => Object.entries(props).map(([name, value]) => `${name}=${value}`).join(' · ');
  return { variants: rows.map((props) => ({ label: label(props), props })), dropped: axes.filter((a) => !kept.includes(a)).map((a) => a.name), total };
}
