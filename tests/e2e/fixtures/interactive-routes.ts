import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

export const HERO_ID = 'lumen-hero';
export const LUMEN_PATH = '/__lumen';

export function serveLumen(page: Page, origin: string, dir: string): Promise<void[]> {
  const read = (file: string) => readFileSync(join(dir, file), 'utf8');
  return Promise.all([
    page.route(`${origin}/e/${HERO_ID}.json`, (route) => route.fulfill({ contentType: 'application/json', body: read('hero.json') })),
    page.route(`${origin}/e/${HERO_ID}`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: read('hero.html') })),
    page.route(`${origin}${LUMEN_PATH}`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: read('page.html') }))
  ]);
}
