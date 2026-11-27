import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

const ROOT_LAYOUTS = ['src/routes/+layout.svelte', 'src/app/layout.tsx', 'src/app/layout.jsx', 'app/layout.tsx', 'app/layout.jsx', 'src/app.vue', 'app.vue'];
const STYLE_IMPORT = /^[ \t]*import\s+['"]([^'"]+\.(?:css|scss|sass|less|pcss|styl))['"]/gm;
const RELATIVE = /^\.{1,2}\//;

export function styleImportsOf(code: string, layoutFile: string): string[] {
  return [...code.matchAll(STYLE_IMPORT)].map(([, spec]) => (RELATIVE.test(spec) ? `/${posix.join(dirname(layoutFile), spec)}` : spec));
}

export function layoutStylesOf(root: string): string[] {
  return ROOT_LAYOUTS.filter((file) => existsSync(join(root, file))).flatMap((file) => styleImportsOf(readFileSync(join(root, file), 'utf8'), file));
}
