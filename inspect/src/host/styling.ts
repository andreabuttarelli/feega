import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Styling } from '../messages';
import { StylingChoice } from '../settings';

const TAILWIND_PACKAGES = ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'];

type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const CHOSEN: Record<StylingChoice, Styling | null> = {
  [StylingChoice.Auto]: null,
  [StylingChoice.Tailwind]: Styling.Tailwind,
  [StylingChoice.Css]: Styling.Css
};

export async function stylingOf(root: string, choice = StylingChoice.Auto): Promise<Styling> {
  const chosen = CHOSEN[choice];
  if (chosen) {
    return chosen;
  }
  const text = await readFile(join(root, 'package.json'), 'utf8').catch(() => '{}');
  const manifest = JSON.parse(text) as Manifest;
  const deps = { ...manifest.dependencies, ...manifest.devDependencies };
  return TAILWIND_PACKAGES.some((name) => name in deps) ? Styling.Tailwind : Styling.Css;
}
