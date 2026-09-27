import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * LA TOP BAR SONO DUE RIQUADRI GALLEGGIANTI, non una barra a tutta larghezza: uno strato
 * invisibile largo quanto lo schermo mangiava i clic sulla tela fra i due gruppi di controlli.
 * Il wrapper resta `pointer-events: none`, solo i riquadri tornano `auto`.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const top = readFileSync(join(dir, 'CanvasTopBar.svelte'), 'utf8');

describe('la top bar è due riquadri, non una barra piena', () => {
  it('il wrapper non intercetta i clic: solo i riquadri sono interattivi', () => {
    const wrapperMatch = top.match(/\.canvas-topbar\s*{([^}]*)}/);
    expect(wrapperMatch).not.toBeNull();
    expect(wrapperMatch?.[1]).toMatch(/pointer-events:\s*none/);
  });

  it('i riquadri tornano interattivi', () => {
    const boxMatch = top.match(/\.top-box\s*{([^}]*)}/);
    expect(boxMatch).not.toBeNull();
    expect(boxMatch?.[1]).toMatch(/pointer-events:\s*auto/);
  });

  it('gli 8px dal bordo sono in un unico posto: stessa costante della add bar in basso', () => {
    const addBar = readFileSync(join(dir, 'CanvasAddBar.svelte'), 'utf8');
    expect(addBar).toMatch(/bottom:\s*8px/);
    expect(top).toMatch(/top:\s*8px/);
  });

  it('il riquadro sinistro sta a 8px dal bordo sinistro', () => {
    const leftMatch = top.match(/\.top-box\.left\s*{([^}]*)}/) ?? top.match(/\.top-left\s*{([^}]*)}/);
    expect(leftMatch?.[1]).toMatch(/left:\s*8px/);
  });

  it('il riquadro destro sta a 8px dal bordo destro', () => {
    const rightMatch = top.match(/\.top-box\.right\s*{([^}]*)}/) ?? top.match(/\.top-right\s*{([^}]*)}/);
    expect(rightMatch?.[1]).toMatch(/right:\s*8px/);
  });

  it('entrambi i riquadri hanno lo sfondo di carta, un bordo di 1px e l\'ombra della add bar', () => {
    const boxRule = top.match(/\.top-box\s*{([^}]*)}/);
    expect(boxRule).not.toBeNull();
    expect(boxRule?.[1]).toMatch(/border:\s*1px solid var\(--line-2/);
    expect(boxRule?.[1]).toMatch(/box-shadow:\s*0 4px 18px rgb\(0 0 0 \/ 0\.1\)/);
  });
});

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

  it('CreditAmount resta, e il link va alle impostazioni di fatturazione del progetto via openSheet', () => {
    expect(top).toMatch(/<CreditAmount/);
    expect(top).toMatch(/openSheet\(projectId, ['"`]\/settings\/billing['"`]\)/);
    expect(top).not.toMatch(/href=["'`]\/app\/billing["'`]/);
  });
});

describe('il menu progetto non punta più a /app', () => {
  it('la voce "nuovo brand" non usa /app come href', () => {
    expect(top).not.toMatch(/href=["'`]\/app["'`]/);
  });
});
