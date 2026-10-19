import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('../../../routes/p/[projectId]/+layout.svelte');
const editor = read('../motion/MotionEditorShell.svelte');
const canvasPane = read('../canvas/CanvasChatPanel.svelte');

describe('the right bar never goes back to the park between canvas and editor', () => {
  it('the canvas pane does not close when a frame opens: it stows only once the editor holds the bar', () => {
    expect(layout).not.toMatch(/<CanvasChatPanel open=\{[^}]*inlineStage\.editing/);
    expect(canvasPane).toMatch(/bind:held/);
  });

  it('the editor claims the bar as soon as it mounts, not when its panels are due', () => {
    expect(editor).not.toMatch(/\{#if panelsDue\}(?:(?!\{\/if\})[^\n])*<BarSlot/);
  });
});
