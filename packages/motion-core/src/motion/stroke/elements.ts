import { strokesOf, strokesSchema, type Stroke } from './model';

type Stroked = { replaces: readonly string[]; legacy: (props: Record<string, unknown>) => Stroke[] };

const UNSTROKED: Stroked = { replaces: [], legacy: () => [] };

export const STROKED: Record<string, Stroked> = {
  Shape: { replaces: ['strokeKind', 'stroke', 'strokeWidth', 'dash', 'gap', 'cap', 'join'], legacy: strokesOf },
  Title: UNSTROKED,
  Text: UNSTROKED,
  Kicker: UNSTROKED,
  Caption: UNSTROKED,
  Image: UNSTROKED
};

export function elementStrokes(component: string, props: Record<string, unknown>): Stroke[] {
  const stored = strokesSchema.safeParse(props.strokes);
  if (props.strokes !== undefined && stored.success) {
    return stored.data;
  }
  return STROKED[component]?.legacy(props) ?? [];
}

export const strokeReplaces = (component: string, key: string): boolean => STROKED[component]?.replaces.includes(key) ?? false;
