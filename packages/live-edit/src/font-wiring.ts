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

export const googleFontUrl = (family: string, axis = WEIGHTS) => `${GOOGLE_CSS}?family=${family.trim().replace(/\s+/g, '+')}:${axis}&display=swap`;

export async function googleFontImport(read: ReadFile, sheet: string, family: string, axis = WEIGHTS): Promise<FileChange | null> {
  const before = (await read(sheet)) ?? '';
  const url = googleFontUrl(family, axis);
  if (before.includes(`family=${family.trim().replace(/\s+/g, '+')}:`)) {
    return null;
  }
  return { path: sheet, before, after: `@import url("${url}");\n${before}` };
}

const HEAD_SHELLS = ['index.html', 'src/app.html', 'public/index.html'];
const LAYOUTS = ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'src/app/layout.tsx', 'src/app/layout.jsx', 'src/app/layout.js'];
const HEAD_CLOSE = /^([ \t]*)<\/head>/m;
const HTML_OPEN = /^([ \t]*)<html\b[^>]*>\n/m;
const HEAD_INDENT = '  ';

const fontLink = (family: string, axis: string) => `<link rel="stylesheet" href="${googleFontUrl(family, axis)}" />`;

const familyKey = (family: string) => `family=${family.trim().replace(/\s+/g, '+')}:`;

function linkedInHead(html: string, family: string, axis: string): string {
  const link = fontLink(family, axis);
  const close = html.match(HEAD_CLOSE);
  if (close) {
    return html.replace(HEAD_CLOSE, `${close[1]}${HEAD_INDENT}${link}\n${close[1]}</head>`);
  }
  return html.replace('</head>', `  ${link}\n</head>`);
}

function linkedInLayout(layout: string, family: string, axis: string): string | null {
  const html = layout.match(HTML_OPEN);
  if (!html) {
    return null;
  }
  const head = `${html[1]}${HEAD_INDENT}<head>\n${html[1]}${HEAD_INDENT}${HEAD_INDENT}${fontLink(family, axis)}\n${html[1]}${HEAD_INDENT}</head>\n`;
  return layout.replace(HTML_OPEN, (whole) => whole + head);
}

export async function googleFontLink(read: ReadFile, family: string, axis = WEIGHTS): Promise<FileChange | null> {
  for (const path of [...HEAD_SHELLS, ...LAYOUTS]) {
    const before = await read(path);
    if (before === null) {
      continue;
    }
    if (before.includes(familyKey(family))) {
      return null;
    }
    const after = path.endsWith('.html') ? (before.includes('</head>') ? linkedInHead(before, family, axis) : null) : linkedInLayout(before, family, axis);
    if (after) {
      return { path, before, after };
    }
  }
  return null;
}
