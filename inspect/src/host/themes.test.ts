import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '@feega/live-edit/themes';
import { themesOf } from './themes';

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'themes-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const names = async (files: Record<string, string>) => (await themesOf(project(files))).map((t) => t.name);

describe('themesOf', () => {
  it('lists only default for a project with no theme', async () => {
    expect(await names({ 'package.json': '{}', 'src/app.css': '.a { color: red }' })).toEqual([DEFAULT_THEME]);
  });

  it('reads themes from any stylesheet under the project', async () => {
    expect(await names({ 'src/styles/app.css': '.dark { --a: 1 }\n[data-theme="forest"] {}' })).toEqual([DEFAULT_THEME, 'dark', 'forest']);
  });

  it('reads the tailwind config', async () => {
    expect(await names({ 'tailwind.config.js': "module.exports = { darkMode: 'class' }", 'package.json': '{"dependencies":{"tailwindcss":"3"}}' })).toEqual([DEFAULT_THEME, 'dark']);
  });

  it('reads dark: in the sources of a tailwind project', async () => {
    expect(await names({ 'package.json': '{"dependencies":{"tailwindcss":"4"}}', 'src/App.tsx': 'export const A = () => <p className="dark:bg-black" />;' })).toEqual([DEFAULT_THEME, 'dark']);
  });

  it('reads next-themes from the sources', async () => {
    const files = { 'package.json': '{"dependencies":{"next-themes":"0.3"}}', 'app/layout.tsx': '<ThemeProvider attribute="class" themes={["light","dark","sepia"]}>' };
    expect(await names(files)).toEqual([DEFAULT_THEME, 'light', 'dark', 'sepia']);
  });

  it('skips node_modules', async () => {
    expect(await names({ 'node_modules/x/a.css': '.dark {}' })).toEqual([DEFAULT_THEME]);
  });
});
