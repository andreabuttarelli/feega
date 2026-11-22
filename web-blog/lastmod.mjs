import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = import.meta.dirname;
const BUILD_DATE = new Date();
const SOURCES = [
  { route: '/posts/', dir: 'src/content/posts' },
  { route: '/use-cases/', dir: 'src/content/usecases' }
];
const EXTENSIONS = ['.mdx', '.md'];
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const DATE_FIELDS = ['updated', 'date'];

function sourceOf(pathname) {
  const entry = SOURCES.find(({ route }) => pathname.startsWith(route));
  if (!entry) {
    return undefined;
  }

  const slug = pathname.slice(entry.route.length, -1);
  return EXTENSIONS.map((ext) => resolve(ROOT, entry.dir, slug + ext)).find(existsSync);
}

function frontmatterDate(file) {
  const block = FRONTMATTER.exec(readFileSync(file, 'utf8'))?.[1] ?? '';

  for (const field of DATE_FIELDS) {
    const value = block.match(new RegExp(`^${field}: (.+)$`, 'm'))?.[1];
    if (value) {
      return new Date(value.trim());
    }
  }

  return undefined;
}

function lastmodOf(url) {
  const file = sourceOf(new URL(url).pathname);
  return (file && frontmatterDate(file)) ?? BUILD_DATE;
}

export function withLastmod(item) {
  return { ...item, lastmod: lastmodOf(item.url) };
}
