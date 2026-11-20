import { ALL_SIZES, Direction, activeAt, overriddenAt, type Breakpoint, type Breakpoints } from '@feega/live-edit/breakpoints';
import { CLASS_RULE, LiveProp, Side, familyRule, type ClassRule, type StyleProp } from '@feega/live-edit/live-fields';
import type { Row } from './controls';

export const FOLLOW = 'follow';

const OPERATOR: Record<Direction, string> = { [Direction.MobileFirst]: '≥', [Direction.DesktopFirst]: '≤' };

const pointOf = (set: Breakpoints, name: string) => set.points.find((p) => p.name === name);

const reach = (set: Breakpoints, point: Breakpoint) => {
  const range = `${OPERATOR[set.direction]} ${point.px}px`;
  return point.name === `${point.px}px` ? range : `${point.name} ${range}`;
};

export function writeTarget(choice: string, fixedSize: boolean, set: Breakpoints, width: number): string | undefined {
  if (choice === ALL_SIZES) {
    return ALL_SIZES;
  }
  if (choice !== FOLLOW && pointOf(set, choice)) {
    return choice;
  }
  return fixedSize ? (activeAt(set, width)?.name ?? ALL_SIZES) : undefined;
}

export function badgeText(set: Breakpoints, target: string | undefined, width: number): string {
  if (target === undefined) {
    return `editing: auto · ${width}px`;
  }
  const point = pointOf(set, target);
  return `editing: ${point ? reach(set, point) : 'all sizes'}`;
}

export const reachItems = (set: Breakpoints): { id: string; label: string }[] => [
  { id: FOLLOW, label: 'Follow the preview' },
  { id: ALL_SIZES, label: 'All sizes' },
  ...set.points.map((p) => ({ id: p.name, label: reach(set, p) }))
];

const ruleOf = (row: Row): { rule: ClassRule | null; side: Side } => {
  const { prop, family, side } = row.change('0');
  return { rule: prop === LiveProp.Class ? familyRule(family ?? '') : CLASS_RULE[prop as StyleProp], side: side ?? Side.All };
};

export function rowOverrides(row: Row, classes: string, set: Breakpoints): string[] {
  const { rule, side } = ruleOf(row);
  return rule ? overriddenAt(set, classes, (utility) => rule.owns(utility, side)) : [];
}

export const overrideTitle = (names: string[], set: Breakpoints): string =>
  `Overridden at ${names.map((n) => reach(set, pointOf(set, n)!)).join(', ')}`;
