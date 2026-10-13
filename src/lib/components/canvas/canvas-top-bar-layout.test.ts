import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const top = readFileSync(join(dir, 'CanvasTopBar.svelte'), 'utf8');

describe('il riquadro destro porta credito, share e il toggle della chat', () => {
  it('il toggle della chat è nel riquadro destro, non più isolato in cima', () => {
    const rightBoxMatch = top.match(/<div class="top-box right"[\s\S]*?<\/div>\s*<\/header>/);
    expect(rightBoxMatch).not.toBeNull();
    expect(rightBoxMatch?.[0]).toMatch(/onclick={onToggleChat}/);
  });

  it('Publish è diventato Share: il link pubblico della tela', () => {
    expect(top).not.toMatch(/onPublish/);
    expect(top).toMatch(/<CanvasShare\b/);
  });

  it('il popover di Share mostra il link /s/<token>, lo copia e lo revoca', () => {
    const share = readFileSync(join(dir, 'CanvasShare.svelte'), 'utf8');
    expect(share).toMatch(/\/s\/\$\{shareToken\}/);
    expect(share).toMatch(/navigator\.clipboard\.writeText/);
    expect(share).toMatch(/ShareState\.Off/);
    expect(share).toMatch(/ShareState\.On/);
  });

  it('CreditAmount resta, e il link va alla pagina crediti del workspace', () => {
    expect(top).toMatch(/<CreditAmount/);
    expect(top).toMatch(/href=\{BILLING_PATH\}/);
  });
});

describe('il menu progetto non punta più a /app', () => {
  it('la voce "nuovo brand" non usa /app come href', () => {
    expect(top).not.toMatch(/href=["'`]\/app["'`]/);
  });
});
