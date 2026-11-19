import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Styling } from '../messages';

const TAILWIND_PACKAGES = ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'];

type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

export async function stylingOf(root: string): Promise<Styling> {
  const text = await readFile(join(root, 'package.json'), 'utf8').catch(() => '{}');
  const manifest = JSON.parse(text) as Manifest;
  const deps = { ...manifest.dependencies, ...manifest.devDependencies };
  return TAILWIND_PACKAGES.some((name) => name in deps) ? Styling.Tailwind : Styling.Css;
}
