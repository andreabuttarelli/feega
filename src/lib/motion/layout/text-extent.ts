import type { ComponentId } from '../components';
import type { Size } from './auto-layout';

export const AVERAGE_ADVANCE = 0.56;
export const CAPITAL_ADVANCE = 0.68;

type TextProps = { text?: unknown; size?: unknown; leading?: unknown; tracking?: unknown; textCase?: unknown };
type Inset = { across: number; down: number };

const NO_INSET: Inset = { across: 0, down: 0 };

const TEXT_INSET: Partial<Record<ComponentId, Inset>> = {
  Title: NO_INSET,
  Text: NO_INSET,
  Kicker: NO_INSET,
  Caption: { across: 1, down: 0.5 }
};

const CAPITALS: Partial<Record<ComponentId, true>> = { Kicker: true };

export function isText(component: ComponentId): boolean {
  return component in TEXT_INSET;
}

export function textExtent(component: ComponentId, props: TextProps, unit: number, width?: number): Size {
  const inset = TEXT_INSET[component] ?? NO_INSET;
  const em = Number(props.size ?? 0) * unit;
  const capitals = CAPITALS[component] || props.textCase === 'upper';
  const advance = em * ((capitals ? CAPITAL_ADVANCE : AVERAGE_ADVANCE) + Number(props.tracking ?? 0));
  const widths = String(props.text ?? '')
    .split('\n')
    .map((line) => line.length * advance);
  const room = width === undefined ? Infinity : Math.max(advance, width - inset.across * em);
  const rows = widths.reduce((n, w) => n + Math.max(1, Math.ceil(w / room)), 0);
  return { width: width ?? Math.max(...widths) + inset.across * em, height: rows * em * Number(props.leading ?? 1) + inset.down * em };
}
