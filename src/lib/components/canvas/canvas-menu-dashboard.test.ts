import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import en from '$lib/i18n/locales/en.json';

const component = readFileSync(fileURLToPath(new URL('./CanvasMenu.svelte', import.meta.url)), 'utf8');

describe('the burger menu leads back to the dashboard', () => {
  it('the first navigate row opens /app, not the project', () => {
    expect(component).toMatch(/id: 'home', group: 'navigate', labelKey: 'app.shell.menu.home', icon: LayoutGrid, href: DASHBOARD_HREF/);
    expect(component).toMatch(/const DASHBOARD_HREF = '\/app'/);
  });

  it('it is called Dashboard', () => {
    expect(en.app.shell.menu.home).toBe('Dashboard');
  });
});
