import { basename, join } from 'node:path';
import type { Page } from '@playwright/test';
import { demo, type Demo } from './demo';
import { contactSheet, renderDemo, videosRoot, type DemoCut } from './render';

export { installCursor } from './demo';

export async function recordDemo(page: Page, cut: DemoCut, script: (d: Demo) => Promise<void>): Promise<string[]> {
  const dir = join(videosRoot(), 'demos', 'raw', `${cut.slug}-${Date.now()}`);
  const d = await demo(page, dir);
  await d.start();
  await script(d);
  const files = await renderDemo(await d.finish(), cut);
  for (const file of files) {
    const sheet = join(dir, basename(file).replace(/\.mp4$/, '-sheet.png'));
    contactSheet(file, sheet);
    console.log(`${file}\n  sheet ${sheet}`);
  }
  return files;
}
