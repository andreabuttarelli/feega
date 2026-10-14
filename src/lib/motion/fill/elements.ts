import { FillType, fillsOf, fillsSchema, type Fill } from './model';

type Filled = { replaces: readonly string[]; legacy: (props: Record<string, unknown>) => Fill[] };

const textColour = (props: Record<string, unknown>): Fill[] => fillsSchema.parse([{ type: FillType.Solid, color: String(props.color ?? '#000000') }]);
const TEXT: Filled = { replaces: ['color'], legacy: textColour };

export const FILLED: Record<string, Filled> = {
  Shape: { replaces: ['fillKind', 'fill', 'fill2', 'gradientAngle'], legacy: fillsOf },
  Title: TEXT,
  Text: TEXT,
  Kicker: TEXT,
  Caption: TEXT
};

export function elementFills(component: string, props: Record<string, unknown>): Fill[] {
  const stored = fillsSchema.safeParse(props.fills);
  if (props.fills !== undefined && stored.success) {
    return stored.data;
  }
  return FILLED[component]?.legacy(props) ?? [];
}

export const fillReplaces = (component: string, key: string): boolean => FILLED[component]?.replaces.includes(key) ?? false;
