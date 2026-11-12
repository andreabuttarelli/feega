import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(dir, 'CanvasTopBar.svelte'), 'utf8');

describe('il nome del progetto nella barra', () => {
  it('e testo fisso, senza menu a tendina', () => {
    expect(source).not.toMatch(/project-switcher/);
    expect(source).not.toMatch(/DropdownMenu\.Root/);
    expect(source).not.toMatch(/switcher-list/);
    expect(source).toMatch(/data-testid="project-name"/);
  });

  it('il doppio clic apre la rinomina', () => {
    expect(source).toMatch(/ondblclick=\{startRenameProject\}/);
    expect(source).toMatch(/data-testid="project-rename-input"/);
  });

  it('il segno ha respiro a sinistra', () => {
    expect(source).toMatch(/padding: 0 3px 0 var\(--topbar-mark-inset\)/);
  });
});
