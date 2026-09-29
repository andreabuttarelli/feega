import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const switcher = readFileSync(join(dir, 'CanvasMobileSwitcher.svelte'), 'utf8');
const topBar = readFileSync(join(dir, 'MobileTopBar.svelte'), 'utf8');

describe('il titolo della mobile top bar apre lo switcher', () => {
  it('il titolo è un bottone che apre CanvasMobileSwitcher', () => {
    expect(topBar).toMatch(/<button[^>]*class="title"[\s\S]*?onclick={\(\) => \(switcherOpen = true\)}/);
    expect(topBar).toMatch(/<CanvasMobileSwitcher/);
  });

  it('passa progetti e tele correnti allo switcher, non li reinventa', () => {
    expect(topBar).toMatch(/{projectName}/);
    expect(topBar).toMatch(/{projects}/);
    expect(topBar).toMatch(/{canvasName}/);
    expect(topBar).toMatch(/{canvases}/);
  });
});

describe('lo switcher elenca le tele del progetto corrente e gli altri progetti', () => {
  it('itera canvases e projects, non un elenco statico', () => {
    expect(switcher).toMatch(/#each canvases as canvas/);
    expect(switcher).toMatch(/#each projects as project/);
  });

  it('ogni riga è alta almeno il touch target', () => {
    const rowRule = switcher.match(/\.row\s*{([^}]*)}/);
    expect(rowRule).not.toBeNull();
    expect(rowRule?.[1]).toMatch(/min-height:\s*var\(--touch-target/);
  });

  it('nessun border-radius, angoli quadrati come il resto della shell mobile', () => {
    expect(switcher).not.toMatch(/border-radius/);
    expect(switcher).not.toMatch(/rounded-/);
  });

  it('naviga per href reale, non un handler che reimplementa il routing', () => {
    expect(switcher).toMatch(/<a href={canvas\.href}/);
    expect(switcher).toMatch(/<a href={project\.href}/);
  });

  it('riusa formatLastEdited invece di duplicare la formattazione della data', () => {
    expect(switcher).toMatch(/import { formatLastEdited } from '\$lib\/canvas\/format-last-edited'/);
  });
});
