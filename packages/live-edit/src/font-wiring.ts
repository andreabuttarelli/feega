import type { FileChange, ReadFile } from './files';

export const GLOBAL_SHEETS = [
  'src/app.css',
  'src/index.css',
  'src/style.css',
  'src/styles.css',
  'src/global.css',
  'src/styles/global.css',
  'src/styles/globals.css',
  'src/assets/main.css',
  'app/globals.css',
  'src/app/globals.css',
  'styles/globals.css',
  'app/app.css'
];

const GOOGLE_CSS = 'https://fonts.googleapis.com/css2';
const WEIGHTS = 'wght@300..800';

const ENTRIES = ['src/routes/+layout.svelte', 'src/main.ts', 'src/main.js', 'src/main.tsx', 'src/main.jsx', 'app/layout.tsx', 'app/layout.jsx', 'src/app/layout.tsx', 'src/App.vue'];
const CSS_IMPORT = /import\s+['"]([^'"]+\.css)['"]/;
const ALIASES: Record<string, string> = { '$lib/': 'src/lib/', '@/': 'src/', '~/': 'src/' };

function resolved(entry: string, spec: string): string {
  const alias = Object.keys(ALIASES).find((a) => spec.startsWith(a));
  if (alias) {
    return ALIASES[alias] + spec.slice(alias.length);
  }
  const parts = entry.split('/').slice(0, -1);
  for (const piece of spec.split('/')) {
    if (piece === '..') {
      parts.pop();
    } else if (piece !== '.') {
      parts.push(piece);
    }
  }
  return parts.join('/');
}

export async function globalSheetOf(read: ReadFile, candidates = GLOBAL_SHEETS): Promise<string | null> {
  for (const path of candidates) {
    if ((await read(path)) !== null) {
      return path;
    }
  }
  for (const entry of ENTRIES) {
    const spec = (await read(entry))?.match(CSS_IMPORT)?.[1];
    if (spec) {
      return resolved(entry, spec);
    }
  }
  return null;
}

export const googleFontUrl = (family: string) => `${GOOGLE_CSS}?family=${family.trim().replace(/\s+/g, '+')}:${WEIGHTS}&display=swap`;

export async function googleFontImport(read: ReadFile, sheet: string, family: string): Promise<FileChange | null> {
  const before = (await read(sheet)) ?? '';
  const url = googleFontUrl(family);
  if (before.includes(`family=${family.trim().replace(/\s+/g, '+')}:`)) {
    return null;
  }
  return { path: sheet, before, after: `@import url("${url}");\n${before}` };
}
