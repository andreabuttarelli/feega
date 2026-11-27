import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pack } from '@feega/plugin-icon-kit/pack';

const SOURCES = ['24/outline', '24/solid', '20/solid', '16/solid'];
const INNER = /<svg[^>]*>([\s\S]*)<\/svg>/;
const SVG_SUFFIX = /\.svg$/;
const COMPACT = /\s*\n\s*/g;

const require = createRequire(import.meta.url);
const ROOT = dirname(require.resolve('heroicons/package.json'));
const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

const bodyOf = (source: string, name: string): string => {
  const file = join(ROOT, source, `${name}.svg`);
  return existsSync(file) ? (readFileSync(file, 'utf8').match(INNER) as RegExpMatchArray)[1].replace(COMPACT, '') : '';
};

export function packedHeroicons(): string {
  const names = readdirSync(join(ROOT, SOURCES[0])).map((file) => file.replace(SVG_SUFFIX, '')).sort();

  return pack(Object.fromEntries(names.map((name) => [name, SOURCES.map((source) => bodyOf(source, name))])));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, `export const PACKED = '${packedHeroicons()}';\n`);
}
