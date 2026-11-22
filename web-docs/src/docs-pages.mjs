import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(HERE, 'content/docs');
const PAGE_FILE = /\.mdx?$/;
const HOME_ID = 'index';

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;
export const COVERS_DIR = resolve(HERE, '../public/covers');

export const coverUrl = (id, ext) => `/covers/${id}.${ext}`;

const field = (source, name) => source.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^(['"])(.*)\1$/, '$2') ?? '';

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(join(dir, e.name)) : PAGE_FILE.test(e.name) ? [join(dir, e.name)] : []));
}

export function docsPages() {
  return filesIn(DOCS_DIR)
    .map((file) => {
      const source = readFileSync(file, 'utf8');
      const id = relative(DOCS_DIR, file).replace(PAGE_FILE, '').split('\\').join('/');
      return { id, title: field(source, 'title'), description: field(source, 'description'), section: id === HOME_ID ? '' : id.split('/')[0].replaceAll('-', ' ') };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
