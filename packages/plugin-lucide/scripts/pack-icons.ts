import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generatedSource, installedVersion } from '@feega/plugin-icon-kit/pack';

const PACKAGE = 'lucide-static';

const require = createRequire(import.meta.url);
const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

export const version = (): string => installedVersion(PACKAGE);

export function indexData(): Record<string, string[]> {
  const tags: Record<string, string[]> = JSON.parse(readFileSync(require.resolve(`${PACKAGE}/tags.json`), 'utf8'));
  const names = Object.keys(JSON.parse(readFileSync(require.resolve(`${PACKAGE}/icon-nodes.json`), 'utf8'))).sort();

  return Object.fromEntries(names.map((name) => [name, tags[name] ?? []]));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, generatedSource(version(), indexData()));
}
