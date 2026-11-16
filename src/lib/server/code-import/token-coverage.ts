import type { Declared } from './css-tokens';
import { labelOf, type TokenMap } from './design-tokens';

export type Counts = { declared: number; imported: number };

export type Coverage = Record<string, Counts>;

const NAME = /^(--[\w.-]+)/;

export const declaredNames = (declared: Declared[], skipped: string[]): string[] => [...new Set([...declared.map((d) => d.name), ...skipped.flatMap((s) => NAME.exec(s)?.[1] ?? [])])];

export function coverageOf(declared: string[], map: TokenMap): Coverage {
  const names = new Set(declared);
  const imported = new Set(Object.values(map).map((e) => e.name).filter((n) => names.has(n)));
  const out: Coverage = {};
  for (const name of names) {
    const label = labelOf(name);
    out[label] ??= { declared: 0, imported: 0 };
    out[label].declared++;
    out[label].imported += imported.has(name) ? 1 : 0;
  }
  return out;
}
