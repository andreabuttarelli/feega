import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BREAKPOINTS, Direction } from '@feega/live-edit/breakpoints';
import { breakpointsOf } from './breakpoints';

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'bp-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('breakpointsOf', () => {
  it('defaults when the project says nothing', async () => {
    expect(await breakpointsOf(project({ 'package.json': '{}' }))).toEqual(DEFAULT_BREAKPOINTS);
  });

  it('reads a v4 theme from any stylesheet under the project', async () => {
    const root = project({ 'src/styles/app.css': '@theme { --breakpoint-md: 50rem; }' });
    const out = await breakpointsOf(root);
    expect(out.points.find((p) => p.name === 'md')?.px).toBe(800);
  });

  it('reads the tailwind config', async () => {
    const root = project({ 'tailwind.config.ts': "export default { theme: { screens: { tab: '700px' } } }" });
    expect((await breakpointsOf(root)).points).toEqual([{ name: 'tab', px: 700 }]);
  });

  it('reads media queries and detects desktop-first', async () => {
    const root = project({ 'src/a.css': '@media (max-width: 900px) {}', 'src/b.css': '@media (max-width: 600px) {}' });
    const out = await breakpointsOf(root);
    expect(out.direction).toBe(Direction.DesktopFirst);
    expect(out.points.map((p) => p.px)).toEqual([600, 900]);
  });

  it('skips node_modules', async () => {
    const root = project({ 'node_modules/lib/x.css': '@media (min-width: 111px) {}' });
    expect(await breakpointsOf(root)).toEqual(DEFAULT_BREAKPOINTS);
  });
});
