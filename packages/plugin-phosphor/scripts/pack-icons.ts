import { writeFileSync } from 'node:fs';
import { icons } from '@phosphor-icons/core';
import { generatedSource, installedVersion } from '@feega/plugin-icon-kit/pack';

const PACKAGE = '@phosphor-icons/core';
const NEW_MARK = '*new*';
const GENERATED = new URL('../src/packed.generated.ts', import.meta.url);

export const version = (): string => installedVersion(PACKAGE);

export function indexData(): Record<string, string[]> {
  const sorted = [...icons].sort((a, b) => a.name.localeCompare(b.name));

  return Object.fromEntries(sorted.map((icon) => [icon.name, icon.tags.filter((tag) => tag !== NEW_MARK)]));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  writeFileSync(GENERATED, generatedSource(version(), indexData()));
}
