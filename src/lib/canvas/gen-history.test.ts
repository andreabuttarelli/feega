import { describe, it, expect } from 'vitest';
import { withRun, showRun, shownIndex, canStartRun, blockedReason, historyItemsOf, RUNNABLE_MEDIUMS, shownOutput } from './gen-history';
import type { GenNode, GenRun } from './gen-node';

const choices = [{ id: 'm1' }];

const node = (over: Partial<GenNode> = {}): GenNode => ({
  id: 'n1',
  medium: 'image',
  model: 'm1',
  prompt: 'un gatto',
  params: {},
  refId: null,
  runs: [],
  ...over
});

const run = (over: Partial<GenRun> = {}): GenRun => ({
  id: 'r1',
  mediaId: 'media-1',
  prompt: 'un gatto',
  model: 'm1',
  createdAt: '2026-09-21T10:00:00Z',
  ...over
});

describe('la storia delle generazioni', () => {
  it('tiene la generazione di prima invece di sovrascriverla', () => {
    const first = withRun(node(), run({ id: 'r1', mediaId: 'media-1' }));
    const second = withRun(first, run({ id: 'r2', mediaId: 'media-2' }));

    expect(second.runs.map((r) => r.mediaId)).toEqual(['media-1', 'media-2']);
  });

  it('mostra sempre l ultima appena arriva: è quella che si è appena pagata', () => {
    const after = withRun(node({ refId: 'media-1' }), run({ id: 'r2', mediaId: 'media-2' }));

    expect(after.refId).toBe('media-2');
  });

  it('una esecuzione senza asset non entra nella storia', () => {
    // Un video parte e atterra minuti dopo: finché non c'è un media da rivedere, una riga in
    // striscia sarebbe una miniatura che non si può aprire.
    const after = withRun(node(), run({ mediaId: null }));

    expect(after.runs).toEqual([]);
    expect(after.refId).toBeNull();
  });

  it('non rimette in storia la stessa esecuzione arrivata due volte', () => {
    const once = withRun(node(), run());
    const twice = withRun(once, run());

    expect(twice.runs).toHaveLength(1);
  });
});

describe('tornare a una generazione di prima', () => {
  it('rimette in mostra quella scelta senza toglierla dalla storia', () => {
    const two = { ...node(), runs: [run({ id: 'r1', mediaId: 'media-1' }), run({ id: 'r2', mediaId: 'media-2' })], refId: 'media-2' };

    const back = showRun(two, 'r1');

    expect(back.refId).toBe('media-1');
    expect(back.runs).toHaveLength(2);
  });

  it('un id che non esiste lascia il nodo com era: non si svuota quel che si vede', () => {
    const one = { ...node(), runs: [run()], refId: 'media-1' };

    expect(showRun(one, 'ignoto')).toEqual(one);
  });

  it('dice quale delle esecuzioni si sta guardando', () => {
    const two = { ...node(), runs: [run({ id: 'r1', mediaId: 'media-1' }), run({ id: 'r2', mediaId: 'media-2' })], refId: 'media-1' };

    expect(shownIndex(two)).toBe(0);
  });

  it('senza niente in mostra non indica nessuna esecuzione', () => {
    expect(shownIndex(node())).toBe(-1);
  });
});

describe('il doppio clic su Genera', () => {
  it('non lancia due volte: la seconda pressione trova il nodo già in corso', () => {
    // Un giro costa crediti veri. Senza questa guardia due clic vicini pagano due render, e il
    // secondo sovrascrive il primo appena atterra.
    expect(canStartRun(node({ running: true }), choices)).toBe(false);
  });

  it('un nodo senza prompt non parte', () => {
    expect(canStartRun(node({ prompt: '  ' }), choices)).toBe(false);
  });

  it('un nodo senza prompt proprio ma con un testo a monte collegato parte lo stesso', () => {
    // Il difetto segnalato: un nodo immagine collegato a un testo scritto restava spento perché
    // solo il proprio prompt contava.
    expect(canStartRun(node({ prompt: '' }), choices, { hasUpstreamText: true })).toBe(true);
  });

  it('un nodo senza modello salvato E senza catalogo non parte: non c è niente da risolvere', () => {
    expect(canStartRun(node({ model: null }), [])).toBe(false);
  });

  it('un nodo senza modello salvato MA con un catalogo parte: usa il default del medium', () => {
    // `default-models.ts::effectiveModel` risolve un nodo vecchio, mai scritto in `nodes.data` —
    // il nodo resta senza `model` salvato, solo la GATE smette di bloccarlo.
    expect(canStartRun(node({ model: null }), choices)).toBe(true);
  });

  it('un nodo che ha già prodotto può rifare: è la seconda generazione, non un errore', () => {
    expect(canStartRun(node({ refId: 'media-1' }), choices)).toBe(true);
  });

  it('pronto e con modello, parte', () => {
    expect(canStartRun(node(), choices)).toBe(true);
  });

  it('un nodo di testo parte come gli altri: il testo atterra su un asset', () => {
    expect(canStartRun(node({ medium: 'text' }), choices)).toBe(true);
  });
});

describe('perché un nodo non parte', () => {
  it('lo dice invece di lasciare un bottone spento senza spiegazione', () => {
    // Un bottone disabilitato e muto è il difetto che l utente ha segnalato come «non funziona»:
    // non poteva distinguere «rotto» da «manca qualcosa».
    expect(blockedReason(node({ prompt: '' }), choices)).toMatch(/what you want/i);
    expect(blockedReason(node({ model: null }), [])).toMatch(/model/i);
  });

  it('a 3D node without a prompt is not blocked: the image is what it reads', () => {
    expect(blockedReason(node({ medium: 'model3d', prompt: '', model: 'wiro/microsoft/trellis-2' }), choices)).toBeNull();
  });

  it('senza modello salvato ma con un catalogo, non ha niente da spiegare: il default lo risolve', () => {
    expect(blockedReason(node({ model: null }), choices)).toBeNull();
  });

  it('per il testo senza modello e senza catalogo dice di sceglierlo, come per gli altri', () => {
    expect(blockedReason(node({ medium: 'text', model: null, prompt: 'x' }), [])).toMatch(/model/i);
  });

  it('un nodo che può partire non ha niente da spiegare', () => {
    expect(blockedReason(node(), choices)).toBeNull();
  });

  it('un testo a monte collegato basta: niente da spiegare anche senza prompt proprio', () => {
    expect(blockedReason(node({ prompt: '' }), choices, { hasUpstreamText: true })).toBeNull();
  });

  it('girano tutti e tre i medium che producono: il testo atterra su un asset', () => {
    expect(RUNNABLE_MEDIUMS).toEqual(['text', 'image', 'video', 'audio', 'model3d']);
  });
});

describe('la storia di un nodo mostra solo i giri che hanno prodotto qualcosa', () => {
  it('scarta i giri falliti o senza risultato, tiene gli altri nell\'ordine', async () => {
    const { producedRuns } = await import('./gen-history');
    const run = (id: string, mediaId: string | null): GenRun => ({ id, mediaId, prompt: 'p', model: null, createdAt: '' });
    expect(producedRuns([run('a', 'x'), run('b', null), run('c', 'y')]).map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('la storia mostra ogni risultato una volta sola', () => {
  it('due giri con lo stesso asset (il biglietto del loop e il giro vero) sono una voce sola', async () => {
    const { producedRuns } = await import('./gen-history');
    const run = (id: string, mediaId: string | null): GenRun => ({ id, mediaId, prompt: 'p', model: null, createdAt: '' });
    expect(producedRuns([run('t1', 'a'), run('t2', 'b'), run('r1', 'a'), run('r2', 'b')]).map((r) => r.id)).toEqual(['t1', 't2']);
  });
});

describe('un giro in arrivo con un risultato già in storia non lo duplica', () => {
  it('withRun ignora un secondo giro con lo stesso asset', async () => {
    const { withRun } = await import('./gen-history');
    const first: GenRun = { id: 't1', mediaId: 'a', prompt: 'p', model: null, createdAt: '' };
    const node = { runs: [first], refId: 'a' } as unknown as GenNode;
    const next = withRun(node, { ...first, id: 'r1' });
    expect(next.runs.map((r) => r.id)).toEqual(['t1']);
  });
});

describe('la griglia della storia', () => {
  const four = [1, 2, 3, 4].map((n) => run({ id: `r${n}`, mediaId: `media-${n}` }));

  it('non c è con un giro solo: il nodo mostra già quel risultato', () => {
    expect(historyItemsOf(node({ runs: four.slice(0, 1), refId: 'media-1' }))).toEqual([]);
  });

  it('elenca ogni risultato nell ordine e accende quello in vetrina', () => {
    const items = historyItemsOf(node({ runs: four, refId: 'media-3' }));

    expect(items.map((i) => [i.runId, i.mediaId, i.shown])).toEqual([
      ['r1', 'media-1', false],
      ['r2', 'media-2', false],
      ['r3', 'media-3', true],
      ['r4', 'media-4', false]
    ]);
    expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4]);
  });

  it('salta i giri senza risultato', () => {
    const items = historyItemsOf(node({ runs: [...four.slice(0, 2), run({ id: 'r3', mediaId: null })], refId: 'media-1' }));

    expect(items.map((i) => i.runId)).toEqual(['r1', 'r2']);
  });
});

describe('shownOutput: picking a past output never touches the run in flight', () => {
  const past = { id: 'run-1', mediaId: 'asset-1' };

  it('a running node keeps running, its run id and its error', () => {
    const data = { running: true, runId: 'run-2', error: null, refId: 'asset-0' };
    expect(shownOutput(data, past)).toEqual({ running: true, runId: 'run-2', error: null, refId: 'asset-1' });
  });

  it('an idle node points at the picked run and drops a stale error', () => {
    const data = { running: false, runId: 'run-2', error: 'boom', refId: 'asset-0' };
    expect(shownOutput(data, past)).toEqual({ running: false, runId: 'run-1', error: null, refId: 'asset-1' });
  });
});
