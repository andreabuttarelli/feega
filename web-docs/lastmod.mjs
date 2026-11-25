import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = import.meta.dirname;
const DOCS_DIR = resolve(ROOT, 'src/content/docs');
const BUILD_DATE = new Date();
const EXTENSIONS = ['.mdx', '.md'];
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const DATE_FIELD = 'lastUpdated';
const HOME_ID = 'index';

function sourceOf(pathname) {
  const id = pathname.replace(/^\/|\/$/g, '') || HOME_ID;
  return EXTENSIONS.flatMap((ext) => [resolve(DOCS_DIR, `${id}${ext}`), resolve(DOCS_DIR, id, `index${ext}`)]).find(existsSync);
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function frontmatterDate(file) {
  const block = FRONTMATTER.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
  const value = block.match(new RegExp(`^${DATE_FIELD}: (.+)$`, 'm'))?.[1];
  return value ? validDate(value.trim()) : undefined;
}

function gitDate(file) {
  try {
    return validDate(execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim());
  } catch {
    return undefined;
  }
}

function lastmodOf(url) {
  const file = sourceOf(new URL(url).pathname);
  if (!file) {
    return BUILD_DATE;
  }

  return frontmatterDate(file) ?? gitDate(file) ?? BUILD_DATE;
}

export function withLastmod(item) {
  return { ...item, lastmod: lastmodOf(item.url) };
}
