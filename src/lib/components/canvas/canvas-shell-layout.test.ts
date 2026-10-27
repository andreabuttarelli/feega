import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const rule = (source: string, selector: string) => source.match(new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')}\\s*{([^}]*)}`))?.[1] ?? '';
const shell = readFileSync(join(dir, '../../../routes/p/[projectId]/+layout.svelte'), 'utf8');

describe('the canvas shell: a full-bleed canvas under floating rounded groups (DESIGN.md)', () => {
  it('the top bar overlays the canvas and only its groups catch the pointer', () => {
    const top = read('CanvasTopBar.svelte');
    const bar = rule(top, '.canvas-topbar');
    expect(bar).toMatch(/position:\s*absolute/);
    expect(bar).toMatch(/pointer-events:\s*none/);
    expect(bar).not.toMatch(/background:\s*var/);
    expect(rule(top, '.top-group')).toMatch(/border-radius:\s*var\(--ui-radius-full\)/);
  });

  it('the left bar is a floating pill over the canvas', () => {
    const rail = rule(read('FloatingRail.svelte'), '.rail');
    expect(rail).toMatch(/position:\s*absolute/);
    expect(rail).toMatch(/box-shadow:\s*var\(--ui-shadow-float\)/);
    expect(rail).toMatch(/border-radius:\s*var\(--ui-radius-full\)/);
  });

  it('a left panel floats over the canvas as a rounded card', () => {
    const panel = rule(read('CanvasLeftPanel.svelte'), '.left-panel');
    expect(panel).toMatch(/position:\s*absolute/);
    expect(panel).toMatch(/border-radius:\s*var\(--ui-radius-lg\)/);
  });

  it('the right bar floats as a rounded card, and opens on its own when a frame is selected', () => {
    const chat = read('CanvasChatPanel.svelte');
    expect(chat).toMatch(/border-radius:\s*var\(--ui-radius-lg\)/);
    expect(shell).toMatch(/readChatOpen\(false\)/);
    expect(shell).toMatch(/<CanvasChatPanel open=\{chatOpen \|\| framePicked\}/);
  });

  it('the canvas stage spans the whole row, the chrome sits on top of it', () => {
    const top = shell.indexOf('<CanvasTopBar');
    const row = shell.indexOf('<div class="canvas-row"');
    const rail = shell.indexOf('<FloatingRail');
    const panel = shell.indexOf('<CanvasLeftPanel');
    const stage = shell.indexOf('<div class="canvas-stage">');
    expect(top).toBeGreaterThan(-1);
    expect(top).toBeLessThan(row);
    expect(row).toBeLessThan(rail);
    expect(rail).toBeLessThan(panel);
    expect(panel).toBeLessThan(stage);
    expect(rule(shell, '.canvas-row')).toMatch(/position:\s*relative/);
  });

  it('the frame timeline floats between the side panels instead of sliding under them', () => {
    expect(shell).toMatch(/style:--shell-left=/);
    expect(shell).toMatch(/style:--shell-right=/);
    const timeline = read('FrameTimeline.svelte');
    expect(timeline).toMatch(/left:\s*var\(--shell-left/);
    expect(timeline).toMatch(/right:\s*var\(--shell-right/);
    expect(timeline).toMatch(/border-radius:\s*var\(--ui-radius-lg\)/);
  });
});
