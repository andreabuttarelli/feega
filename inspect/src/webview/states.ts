import { ElementState, STATE_FACTS, pseudoOf, statesFor } from '@feega/live-edit/element-state';
import type { Row, Styles } from './controls';

export function changedKeys(rows: Row[], styles: Styles, baseline: Styles | null): Set<string> {
  const keys = new Set<string>();
  if (!baseline) {
    return keys;
  }
  for (const row of rows) {
    if (row.read(styles) !== row.read(baseline)) {
      [row.name, row.group, row.section].forEach((key) => key && keys.add(key));
    }
  }
  return keys;
}

export const isChanged = (keys: Set<string>, key: string): boolean => keys.has(key);

export const switchStates = statesFor;

export const badgeOf = pseudoOf;

export const stateLabel = (state: ElementState): string => STATE_FACTS[state].label;
