import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readThemes, type Theme } from '@feega/live-edit/themes';
import { scanProject } from './project-scan';

const CONFIGS = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs'];
const MAX_SOURCE_BYTES = 200_000;

const text = (path: string) => readFile(path, 'utf8').catch(() => null);

const present = (texts: (string | null)[]) => texts.filter((t): t is string => t !== null);

export async function themesOf(root: string): Promise<Theme[]> {
  const scan = await scanProject(root);
  const [sheets, sources, configs, packageJson] = await Promise.all([
    Promise.all(scan.sheets.map(text)),
    Promise.all(scan.sources.map(text)),
    Promise.all(CONFIGS.map((name) => text(join(root, name)))),
    text(join(root, 'package.json'))
  ]);
  return readThemes({
    packageJson,
    tailwindConfig: configs.find((c) => c !== null) ?? null,
    sheets: present(sheets),
    sources: present(sources).filter((s) => s.length <= MAX_SOURCE_BYTES)
  });
}
