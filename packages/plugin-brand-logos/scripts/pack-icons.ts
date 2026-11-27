import { writeFileSync } from 'node:fs';
import * as simpleIcons from 'simple-icons';
import { pack } from '@feega/plugin-icon-kit/pack';

type Brand = { title: string; slug: string; hex: string; path: string };

const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

export function logosData(): Record<string, string[]> {
  const brands = Object.values(simpleIcons).filter((value): value is Brand => typeof value === 'object' && value !== null && 'slug' in value);

  return Object.fromEntries(brands.sort((a, b) => a.slug.localeCompare(b.slug)).map((brand) => [brand.slug, [brand.title, brand.hex, brand.path]]));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, `export const PACKED = '${pack(logosData())}';\n`);
}
