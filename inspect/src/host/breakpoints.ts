import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readBreakpoints, type Breakpoints } from '@feega/live-edit/breakpoints';
import { scanProject } from './project-scan';

const CONFIGS = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs'];

const text = (path: string) => readFile(path, 'utf8').catch(() => null);

export async function breakpointsOf(root: string): Promise<Breakpoints> {
  const { sheets: paths } = await scanProject(root);
  const sheets = (await Promise.all(paths.map(text))).filter((t): t is string => t !== null);
  const configs = await Promise.all(CONFIGS.map((name) => text(join(root, name))));
  return readBreakpoints({ tailwindConfig: configs.find((c) => c !== null) ?? null, sheets });
}
