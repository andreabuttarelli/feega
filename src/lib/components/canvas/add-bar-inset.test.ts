import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'CanvasAddBar.svelte'), 'utf8');

const token = (name: string) => Number(new RegExp(`${name}: (\\d+)px`).exec(source)?.[1]);

describe('the add bar mode pill', () => {
  it('sits as far from the right edge as from the top and bottom', () => {
    const barHeight = token('--bar-item') + 2 * token('--bar-pad');
    const verticalInset = (barHeight - token('--mode-pill')) / 2;

    expect(verticalInset).toBeGreaterThan(0);
    expect(source).toContain('--mode-inset: calc((var(--bar-item) + 2 * var(--bar-pad) - var(--mode-pill)) / 2)');
    expect(source).toContain('padding-right: var(--mode-inset)');
  });
});
