import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const leftPanel = readFileSync(join(dir, 'CanvasLeftPanel.svelte'), 'utf8');

describe('Assets panel', () => {
  it('lists assets only, components have their own panel', () => {
    expect(leftPanel).not.toMatch(/ComponentsList/);
    expect(leftPanel).toMatch(/<ProjectDragPanel/);
  });

  it('uses the compact section header, not the big title', () => {
    expect(leftPanel).not.toMatch(/left-panel-head/);
    expect(leftPanel).toMatch(/data-testid="panel-close"/);
  });
});
