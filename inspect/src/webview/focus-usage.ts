import type { ControlKind } from './prop-controls';

export type PropTally = { control: ControlKind; prop_count: number };

export function propTally() {
  const counts = new Map<ControlKind, number>();

  const add = (control: ControlKind) => void counts.set(control, (counts.get(control) ?? 0) + 1);

  function drain(): PropTally[] {
    const rows = [...counts].map(([control, prop_count]) => ({ control, prop_count }));
    counts.clear();

    return rows;
  }

  return { add, drain };
}
