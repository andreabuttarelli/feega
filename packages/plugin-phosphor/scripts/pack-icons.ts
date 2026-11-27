import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { icons } from '@phosphor-icons/core';
import { pack } from '@feega/plugin-icon-kit/pack';

const WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];
const NEW_MARK = '*new*';
const INNER = /<svg[^>]*>([\s\S]*)<\/svg>/;

const require = createRequire(import.meta.url);
const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

const assetOf = (name: string, weight: string) => `@phosphor-icons/core/assets/${weight}/${weight === 'regular' ? name : `${name}-${weight}`}.svg`;

const bodyOf = (name: string, weight: string): string => (readFileSync(require.resolve(assetOf(name, weight)), 'utf8').match(INNER) as RegExpMatchArray)[1].trim();

export function packedPhosphor(): string {
  const sorted = [...icons].sort((a, b) => a.name.localeCompare(b.name));

  return pack(Object.fromEntries(sorted.map((icon) => [icon.name, [WEIGHTS.map((weight) => bodyOf(icon.name, weight)), icon.tags.filter((tag) => tag !== NEW_MARK)]])));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, `export const PACKED = '${packedPhosphor()}';\n`);
}
