export enum ControlKind {
  Select = 'select',
  Toggle = 'toggle',
  Text = 'text',
  Number = 'number',
  Children = 'children'
}

export type PropValue = string | number | boolean;
export type PropControl = { name: string; kind: ControlKind; options?: string[]; default?: PropValue };
export type Variant = { label: string; props: Record<string, PropValue> };
export type Variants = { variants: Variant[] | null; dropped: string[]; total: number };

export const VARIANT_CAP = 24;
const CHILDREN = 'children';

function observedKind(name: string, value: unknown): ControlKind | null {
  if (name === CHILDREN) {
    return typeof value === 'string' || typeof value === 'number' ? ControlKind.Children : null;
  }
  const byType: Record<string, ControlKind> = { string: ControlKind.Text, boolean: ControlKind.Toggle, number: ControlKind.Number };
  return byType[typeof value] ?? null;
}

export function controlsOf(documented: PropControl[] | null, observed: Record<string, unknown>): PropControl[] {
  const known = new Set((documented ?? []).map((c) => c.name));
  const added = Object.entries(observed).flatMap(([name, value]) => {
    const kind = known.has(name) ? null : observedKind(name, value);
    return kind ? [{ name, kind }] : [];
  });
  return [...(documented ?? []), ...added];
}

const axisOf = (control: PropControl): PropValue[] | null => (control.kind === ControlKind.Select ? (control.options ?? null) : control.kind === ControlKind.Toggle ? [false, true] : null);

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
