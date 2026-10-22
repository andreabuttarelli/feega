import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const editor = read('../motion/MotionEditorShell.svelte');
const canvasPane = read('../canvas/CanvasChatPanel.svelte');

describe('the right bar never goes back to the park between canvas and editor', () => {
  it('the editor on the canvas seats the bar in place', () => {
    expect(editor).toMatch(/seat=\{barSeat\}/);
    expect(editor).toMatch(/mount === Mount\.Canvas && viewportOf\(width\) === Viewport\.Desktop \? BarSeat\.InPlace/);
  });

  it('an editor seated in place lays out as desktop, though the canvas pane narrows its host', () => {
    expect(editor).toMatch(/const viewport = \$derived\(barSeat === BarSeat\.InPlace \? Viewport\.Desktop :/);
  });

  it('the editor claims the bar as soon as it mounts, not when its panels are due', () => {
    expect(editor).not.toMatch(/\{#if panelsDue\}(?:(?!\{\/if\})[^\n])*<BarSlot/);
  });

  it('one width for the bar: canvas pane and editor column both read it from the bar host', () => {
    expect(canvasPane).toMatch(/--chat-w: \$\{rightBar\.width\}px/);
    expect(editor).toMatch(/--side-w: \$\{rightBar\.width\}px/);
    expect(editor).toMatch(/<SideColumn [^>]*widthPx=\{rightBar\.width\}/);
  });
});
