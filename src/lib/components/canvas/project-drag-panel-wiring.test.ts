import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TRASCINARE FUNZIONA SOLO QUANDO LA LISTA È SULLO STESSO SCHERMO DELLA TELA.
 *
 * `/p/<progetto>/assets` e `/p/<progetto>/c/<tela>` sono due rotte diverse: un `dragstart` lì e
 * un `ondrop` qui non si parlano attraverso una navigazione di pagina. `CanvasLeftPanel` (aperto
 * dalla rail flottante, `FloatingRail.svelte`) sta invece SEMPRE accanto alla tela aperta — è lì
 * che un trascinamento reale deve poter partire, non solo sulla pagina dedicata.
 *
 * `ProjectDragPanel` offre materiale che si trascina davvero, con lo stesso
 * pacchetto (`assetDrag`) delle pagine dedicate.
 *
 * Si legge il sorgente: montare il pannello intero per verificare un `import` è più peso che
 * risposta.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const leftPanel = readFileSync(join(dir, 'CanvasLeftPanel.svelte'), 'utf8');
const panel = readFileSync(join(dir, 'ProjectDragPanel.svelte'), 'utf8');

describe('il pannello sinistro della tela (Assets)', () => {
  it('monta ProjectDragPanel', () => {
    expect(leftPanel).toMatch(/ProjectDragPanel/);
  });

  it('riceve il progetto', () => {
    expect(leftPanel).toMatch(/<ProjectDragPanel[^>]*projectId/);
  });

  it('costruisce il pacchetto pieno con lo stesso builder delle pagine dedicate', () => {
    expect(panel).toMatch(/assetDrag/);
  });

  it('porta entrambi i MIME al dragstart, pieno e il fallback vuoto', () => {
    expect(panel).toMatch(/CANVAS_DRAG_FILLED_NODE/);
    expect(panel).toMatch(/CANVAS_DRAG_MEDIUM/);
  });

});
