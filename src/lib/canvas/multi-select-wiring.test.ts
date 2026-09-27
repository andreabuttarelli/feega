import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SelectionMode } from '@xyflow/svelte';
import { CANVAS_MODES, CanvasMode } from './canvas-mode';

const dir = dirname(fileURLToPath(import.meta.url));
const flow = readFileSync(join(dir, '..', 'components', 'canvas', 'CanvasFlow.svelte'), 'utf8');

describe('il riquadro di selezione sulla tela', () => {
  it('trascinare sullo sfondo apre il riquadro, non il pan', () => {
    const inside = /<SvelteFlow[\s\S]*?<CanvasPointer/.exec(flow)?.[0] ?? '';
    expect(inside).toMatch(/\{\.\.\.spec\.flow\}/);
    expect(CANVAS_MODES[CanvasMode.Edit].flow).toMatchObject({
      selectionOnDrag: true,
      selectionMode: SelectionMode.Partial,
      panOnDrag: [1, 2]
    });
  });
});
