import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { generatedSource, installedVersion } from '@feega/plugin-icon-kit/pack';

const PACKAGE = 'heroicons';
const DIRECTORIES = ['24/outline', '24/solid', '20/solid', '16/solid'];
const SVG_SUFFIX = /\.svg$/;
const HAS = '1';
const LACKS = '0';

const require = createRequire(import.meta.url);
const ROOT = dirname(require.resolve(`${PACKAGE}/package.json`));
const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

export const version = (): string => installedVersion(PACKAGE);

export function indexData(): Record<string, string> {
  const names = readdirSync(join(ROOT, DIRECTORIES[0])).map((file) => file.replace(SVG_SUFFIX, '')).sort();

  return Object.fromEntries(names.map((name) => [name, DIRECTORIES.map((directory) => (existsSync(join(ROOT, directory, `${name}.svg`)) ? HAS : LACKS)).join('')]));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, generatedSource(version(), indexData()));
}
