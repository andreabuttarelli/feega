import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');

const pages = read('PagesList.svelte');
const topBar = read('CanvasTopBar.svelte');
const leftPanel = read('CanvasLeftPanel.svelte');
const mobile = read('CanvasMobileSwitcher.svelte');

describe('Pages: the canvases of the project', () => {
  it('lists every canvas as a real link', () => {
    expect(pages).toMatch(/#each rows as canvas/);
    expect(pages).toMatch(/href={canvas\.href}/);
    expect(pages).toMatch(/title={canvas\.name}/);
  });

  it('creates, renames and deletes after confirmation', () => {
    expect(pages).toMatch(/data-testid="canvas-new"/);
    expect(pages).toMatch(/data-testid="canvas-rename"/);
    expect(pages).toMatch(/data-testid="canvas-delete"[\s\S]*?onSelect={askDelete}/);
    expect(pages).toMatch(/<ConfirmDialog/);
  });

  it('the row menu opens History, where versions live, and keeps comments', () => {
    expect(pages).toMatch(/data-testid="canvas-more"/);
    expect(pages).toMatch(/data-testid="canvas-history"[\s\S]*?History/);
    expect(pages).not.toMatch(/Versions…/);
    expect(pages).toMatch(/data-testid="canvas-comments"/);
  });

  it('imports and downloads .feega from the panel menu', () => {
    expect(pages).toMatch(/data-testid="pages-menu"/);
    expect(pages).toMatch(/data-testid="canvas-import-feega"/);
    expect(pages).toMatch(/data-testid="canvas-save-feega"/);
  });
});

describe('the current page', () => {
  it('is marked with a dot, aria-current and the Layers selection colour', () => {
    expect(pages).toMatch(/aria-current={isCurrent \? 'page' : undefined}/);
    expect(pages).toMatch(/data-testid="current-dot"/);
    expect(pages).toMatch(/\.page-row\.is-current \{[^}]*background: var\(--ui-selected\)/);
  });
});

describe('where Pages lives', () => {
  it('sits above Layers in the left panel', () => {
    expect(leftPanel).toMatch(/<PagesList[\s\S]*<LayersPanel/);
  });

  it('replaces the canvas-name dropdown in the top bar', () => {
    expect(topBar).not.toMatch(/canvas-switcher/);
    expect(topBar).not.toMatch(/canvas-title/);
  });

  it('is the mobile canvas sheet', () => {
    expect(mobile).toMatch(/<PagesList/);
    expect(mobile).toMatch(/Density\.Touch/);
  });
});
