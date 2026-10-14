import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { frameBar } from './frame-bar.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(dir, '..', 'components', path), 'utf8');

describe('the bottom bar under an open frame dialog', () => {
  it('a frame covered by a dialog stays covered only while its editor is attached', () => {
    const detach = frameBar.attach({ act: () => {} });
    frameBar.covered = true;
    detach();

    expect(frameBar.covered).toBe(false);
  });

  it('the bar steps aside while the frame editor shows a dialog, so it never sits over the dialog buttons', () => {
    expect(read('canvas/CanvasAddBar.svelte')).toMatch(/frameBar\.covered/);
    expect(read('motion/MotionEditorShell.svelte')).toMatch(/frameBar\.covered = /);
  });
});
