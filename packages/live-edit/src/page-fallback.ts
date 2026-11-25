import { addImport } from './add-import';
import type { FileChange, ReadFile } from './files';

export type PageSheet = { path: string; before: string; inner: string; compose: (inner: string) => string; extra: FileChange[]; created: boolean };

type Home = (read: ReadFile, host: string, source: string) => PageSheet | null | Promise<PageSheet | null>;

type Fallback = { hosts: string[]; home: Home };

const ASTRO_LAYOUTS = ['src/layouts/Layout.astro', 'src/layouts/BaseLayout.astro', 'src/layouts/Base.astro', 'src/layouts/Main.astro', 'src/layouts/Default.astro', 'src/pages/index.astro'];
const ASTRO_BLOCK = { open: '<style is:global>', find: /<style\b[^>]*\bis:global\b[^>]*>([\s\S]*?)<\/style>/ };
const VUE_BLOCK = { open: '<style>', find: /<style(?![^>]*\bscoped\b)[^>]*>([\s\S]*?)<\/style>/ };
const HTML_ROOT = /<html\b/;
const BLOCK_END = '</style>';

type Block = { open: string; find: RegExp };

const whole = (inner: string) => inner;

function styleBlock(block: Block): Home {
  return (_read, host, source) => {
    const found = source.match(block.find);
    const compose = (inner: string) => {
      const body = inner.replace(/^\n+/, '').trimEnd();
      if (!found) {
        return `${source.trimEnd()}\n\n${block.open}\n${body}\n${BLOCK_END}\n`;
      }
      const start = found.index! + found[0].indexOf(found[1]);
      return `${source.slice(0, start)}\n${body}\n${source.slice(start + found[1].length).replace(/^\s+/, '')}`;
    };
    return { path: host, before: source, inner: found?.[1] ?? '', compose, extra: [], created: !found };
  };
}

function newSheet(path: string, importLine: string): Home {
  return (_read, host, source) => {
    const imported = addImport(host, source, importLine);
    if (!imported.ok) {
      return null;
    }
    return { path, before: '', inner: '', compose: whole, extra: [{ path: host, before: source, after: imported.after }], created: true };
  };
}

const KIT_LAYOUT = 'src/routes/+layout.svelte';
const KIT_STYLESHEET = 'src/app.css';
const KIT_IMPORT = "import '../app.css';";
const RUNES_MAJOR = 5;
const SVELTE_LAYOUTS = {
  runes: `<script>\n  ${KIT_IMPORT}\n  let { children } = $props();\n</script>\n\n{@render children()}\n`,
  legacy: `<script>\n  ${KIT_IMPORT}\n</script>\n\n<slot />\n`
};

type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

function versionIn(manifest: Manifest, name: string): string | undefined {
  return manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
}

const kitLayout: Home = async (read, host, source) => {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(source);
  } catch {
    return null;
  }
  const svelte = versionIn(manifest, 'svelte');
  if (!versionIn(manifest, '@sveltejs/kit') || !svelte || (await read(KIT_LAYOUT)) !== null) {
    return null;
  }
  const runes = Number(svelte.match(/\d+/)?.[0]) >= RUNES_MAJOR;
  const after = SVELTE_LAYOUTS[runes ? 'runes' : 'legacy'];
  return { path: KIT_STYLESHEET, before: '', inner: '', compose: whole, extra: [{ path: KIT_LAYOUT, before: '', after }], created: true };
};

const astroLayout: Home = (read, host, source) => (HTML_ROOT.test(source) ? styleBlock(ASTRO_BLOCK)(read, host, source) : null);

const PAGE_FALLBACKS: Fallback[] = [
  { hosts: ASTRO_LAYOUTS, home: astroLayout },
  { hosts: ['src/App.vue', 'app.vue'], home: styleBlock(VUE_BLOCK) },
  { hosts: [KIT_LAYOUT], home: newSheet(KIT_STYLESHEET, KIT_IMPORT) },
  { hosts: ['package.json'], home: kitLayout },
  { hosts: ['app/layout.tsx', 'app/layout.jsx'], home: newSheet('app/globals.css', "import './globals.css';") },
  { hosts: ['src/app/layout.tsx', 'src/app/layout.jsx'], home: newSheet('src/app/globals.css', "import './globals.css';") },
  { hosts: ['src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js'], home: newSheet('src/index.css', "import './index.css';") }
];

export async function pageSheetOf(read: ReadFile): Promise<PageSheet | null> {
  for (const row of PAGE_FALLBACKS) {
    for (const host of row.hosts) {
      const source = await read(host);
      const sheet = source === null ? null : await row.home(read, host, source);
      if (sheet) {
        return sheet;
      }
    }
  }
  return null;
}
