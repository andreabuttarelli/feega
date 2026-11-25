import type { ApplyAsk } from '../messages';
import type { Focus } from './focus';
import { ControlKind, type PropControl, type PropValue } from './prop-controls';

export type ApplyPlan = ApplyAsk & { skipped: string[] };

type Edited = { focus: Focus; controls: PropControl[]; values: Record<string, unknown>; touched: string[] };

const NOT_WRITTEN = new Set<ControlKind>([ControlKind.Callback, ControlKind.Children]);

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const atText = ({ file, line, col }: { file: string; line: number; col: number }) => `${file}:${line}:${col}`;

export function applyAskOf({ focus, controls, values, touched }: Edited): ApplyPlan | null {
  if (!focus.usage || !touched.length) {
    return null;
  }
  const ask: ApplyPlan = { component: focus.source.file, usage: atText(focus.usage.at), which: focus.usage.which, set: {}, remove: [], skipped: [] };
  for (const name of touched) {
    const control = controls.find((c) => c.name === name);
    const value = values[name];
    if (control && NOT_WRITTEN.has(control.kind)) {
      ask.skipped.push(name);
    } else if (value === undefined || (control?.default !== undefined && sameValue(value, control.default))) {
      ask.remove.push(name);
    } else {
      ask.set[name] = value as PropValue;
    }
  }
  return ask;
}
