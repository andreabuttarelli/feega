import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const rule = (source: string, selector: string) => source.match(new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')}\\s*{([^}]*)}`))?.[1] ?? '';
const shell = readFileSync(join(dir, '../../../routes/p/[projectId]/+layout.svelte'), 'utf8');

describe('the canvas shell: solid bars around the canvas, set apart by surface not lines (DESIGN.md)', () => {
  it('the top bar is one solid box across the full width, in the flow', () => {
    const bar = rule(read('CanvasTopBar.svelte'), '.canvas-topbar');
    expect(bar).not.toMatch(/position:\s*absolute/);
    expect(bar).toMatch(/background:\s*var\(--ui-surface\)/);
    expect(bar).not.toMatch(/box-shadow/);
  });

  it('the left bar is attached to the window edge, full height, in the flow', () => {
    const rail = rule(read('FloatingRail.svelte'), '.rail');
    expect(rail).not.toMatch(/position:\s*absolute/);
    expect(rail).not.toMatch(/box-shadow/);
    expect(rail).toMatch(/background:\s*var\(--ui-surface\)/);
    expect(rail).toMatch(/align-self:\s*stretch/);
  });

  it('a left panel docks next to the bar and pushes the canvas, it does not float over it', () => {
    const panel = rule(read('CanvasLeftPanel.svelte'), '.left-panel');
    expect(panel).not.toMatch(/position:\s*absolute/);
    expect(panel).not.toMatch(/box-shadow/);
  });

  it('the order on screen is top bar, then left bar, left panel, canvas and chat in a row', () => {
    const top = shell.indexOf('<CanvasTopBar');
    const row = shell.indexOf('<div class="canvas-row">');
    const rail = shell.indexOf('<FloatingRail');
    const panel = shell.indexOf('<CanvasLeftPanel');
    const stage = shell.indexOf('<div class="canvas-stage">');
    expect(top).toBeGreaterThan(-1);
    expect(top).toBeLessThan(row);
    expect(row).toBeLessThan(rail);
    expect(rail).toBeLessThan(panel);
    expect(panel).toBeLessThan(stage);
  });
});
