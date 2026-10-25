import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Recording } from './demo';
import { contactSheet, renderDemo } from './render';

const [dir, slug, title] = process.argv.slice(2);
if (!dir || !slug || !title) {
  throw new Error('usage: npx tsx scripts/demo-record/rerender.ts <recording dir> <slug> "<title>"');
}

const recording = JSON.parse(readFileSync(join(dir, 'recording.json'), 'utf8')) as Recording;
for (const file of await renderDemo(recording, { slug, title })) {
  const sheet = join(dir, file.split('/').pop()!.replace(/\.mp4$/, '-sheet.png'));
  contactSheet(file, sheet);
  console.log(`${file}\n  sheet ${sheet}`);
}
