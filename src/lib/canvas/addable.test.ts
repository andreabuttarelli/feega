import { describe, it, expect } from 'vitest';
import { CANVAS_ADDABLE, isAddable, isGenAddable } from './addable';
import { GEN_MEDIUMS } from './gen-node';

/**
 * DUE DOMANNE DIVERSE, E CONFONDERLE È IL DIFETTO CHE QUESTO FILE EVITA.
 *
 *   `GEN_MEDIUMS` — cosa un nodo PRODUCE. Tre, e li decide il catalogo dei modelli.
 *   `CANVAS_ADDABLE` — cosa si può METTERE sulla tela. Quei tre più la pagina incorporata e il
 *   documento, che non producono niente: portano qualcosa che esiste già.
 *
 * Allargare `GEN_MEDIUMS` con `iframe` o `doc` sarebbe costato poco oggi e avrebbe detto una
 * falsità che si propaga: `defaultParamsFor`, `promptTooLong` e il catalogo dei modelli gli
 * girano attorno, e nessuna di quelle domande ha senso per chi non produce.
 */
describe('cosa si può mettere sulla tela', () => {
  it('contiene i tre medium che si producono, la pagina incorporata, il documento, le due sorgenti che scaricano, i due nodi di loop, gli effetti e la composizione', () => {
    expect(CANVAS_ADDABLE).toEqual([
      ...GEN_MEDIUMS,
      'iframe',
      'doc',
      'products',
      'social_account_feed',
      'list',
      'select',
      'effects',
      'composition',
      'calendar'
    ]);
  });

  it('non allarga i medium che un nodo produce', () => {
    // Il test che tiene i due concetti separati: se qualcuno mettesse `doc` fra i medium,
    // qui diventerebbe rosso.
    expect(GEN_MEDIUMS).not.toContain('doc');
    expect(GEN_MEDIUMS).not.toContain('iframe');
  });

  it('riconosce quel che si può aggiungere e rifiuta il resto', () => {
    expect(isAddable('doc')).toBe(true);
    expect(isAddable('iframe')).toBe(true);
    expect(isAddable('image')).toBe(true);
    expect(isAddable('audio')).toBe(true);
    expect(isAddable('podcast')).toBe(false);
  });

  it('sa dire quali fra questi sono nodi che producono, e quali no', () => {
    // È la domanda che chi crea la tile deve porsi: `newGenNodeAt` o un costruttore nato pieno.
    expect(isGenAddable('image')).toBe(true);
    expect(isGenAddable('iframe')).toBe(false);
    expect(isGenAddable('doc')).toBe(false);
  });
});

describe('la barra mostra solo i nodi pronti', () => {
  it('la pagina web resta aggiungibile ma non compare nella barra', async () => {
    const { CANVAS_ADD_BAR } = await import('./addable');
    expect(CANVAS_ADD_BAR).not.toContain('iframe');
    expect(CANVAS_ADDABLE).toContain('iframe');
    expect(CANVAS_ADD_BAR.every((w) => CANVAS_ADDABLE.includes(w))).toBe(true);
  });
});

describe('la barra corta: tre voci in vista, il resto in «Altro»', () => {
  it('testo, immagine e video in vista; nessuna voce persa né doppia', async () => {
    const { CANVAS_BAR_MAIN, CANVAS_BAR_MORE, CANVAS_ADD_BAR } = await import('./addable');
    expect(CANVAS_BAR_MAIN).toEqual(['text', 'image', 'video']);
    expect([...CANVAS_BAR_MAIN, ...CANVAS_BAR_MORE].sort()).toEqual([...CANVAS_ADD_BAR].sort());
  });
});
