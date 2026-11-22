import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRO_DIR = resolve(HERE, '../../packages/library/pro');
const OUTPUTS = ['.svelte-kit/output', '.vercel/output'].map((dir) => resolve(HERE, '..', dir));

export const proMarks = () => readdirSync(PRO_DIR).map((id) => `fl-${id}`);

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : entry.isFile() ? [path] : [];
  });
}

export const findProSource = (dir, marks) => filesIn(dir).filter((path) => marks.some((mark) => readFileSync(path, 'utf8').includes(mark)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const leaks = OUTPUTS.filter(existsSync).flatMap((dir) => findProSource(dir, proMarks()));
  if (leaks.length) {
    console.error(`pro source in the build:\n${leaks.join('\n')}`);
    process.exit(1);
  }
  console.log('no pro source in the build');
}
