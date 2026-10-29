import type { ComponentId } from '../components';
import type { Size } from './auto-layout';

export const AVERAGE_ADVANCE = 0.5;
export const CAPITAL_ADVANCE = 0.62;
export const ASCENT = 0.8;

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

const SANS_ADVANCES: ReadonlyArray<readonly [string, number]> = [
  ["ijlI'|!", 0.26],
  [' .,:;', 0.29],
  ['ftr', 0.38],
  ['1', 0.42],
  ['-', 0.46],
  ['acekRsvxyzFJLP7', 0.57],
  ['bdghnopqu02345689ESTZ$', 0.62],
  ['ABCDGHKNOQUVXY✓', 0.73],
  ['mwM', 0.88],
  ['W', 1]
];

const ADVANCE_OF: ReadonlyMap<string, number> = new Map(SANS_ADVANCES.flatMap(([chars, advance]) => [...chars].map((c) => [c, advance] as const)));

const runAdvance = (line: string, tracking: number): number => [...line].reduce((sum, c) => sum + (ADVANCE_OF.get(c) ?? AVERAGE_ADVANCE) + tracking, 0);

export function isText(component: ComponentId): boolean {
  return component in TEXT_INSET;
}

export function textExtent(component: ComponentId, props: TextProps, unit: number, width?: number): Size {
  const inset = TEXT_INSET[component] ?? NO_INSET;
  const em = Number(props.size ?? 0) * unit;
  const capitals = CAPITALS[component] || props.textCase === 'upper';
  const tracking = Number(props.tracking ?? 0);
  const advance = em * ((capitals ? CAPITAL_ADVANCE : AVERAGE_ADVANCE) + tracking);
  const text = String(props.text ?? '');
  const widths = (capitals ? text.toUpperCase() : text).split('\n').map((line) => em * runAdvance(line, tracking));
  const room = width === undefined ? Infinity : Math.max(advance, width - inset.across * em);
  const rows = widths.reduce((n, w) => n + Math.max(1, Math.ceil(w / room)), 0);
  return { width: width ?? Math.max(...widths) + inset.across * em, height: rows * em * Number(props.leading ?? 1) + inset.down * em };
}

export function textBaseline(component: ComponentId, props: TextProps, unit: number): number {
  const inset = TEXT_INSET[component] ?? NO_INSET;
  const em = Number(props.size ?? 0) * unit;
  const leading = Number(props.leading ?? 1);
  return (inset.down * em) / 2 + (em * (leading - 1)) / 2 + em * ASCENT;
}

export type TextMeasure = (component: ComponentId, props: TextProps, unit: number, width?: number) => Size;

export const estimatedText: TextMeasure = textExtent;
