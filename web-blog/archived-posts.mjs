import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const POSTS_DIR = resolve(import.meta.dirname, 'src/content/posts');
const ARCHIVED_FLAG = /^archived: true$/m;

export function archivedPaths() {
  return readdirSync(POSTS_DIR)
    .filter((file) => ARCHIVED_FLAG.test(readFileSync(resolve(POSTS_DIR, file), 'utf8')))
    .map((file) => `/posts/${file.replace(/\.mdx?$/, '')}/`);
}
