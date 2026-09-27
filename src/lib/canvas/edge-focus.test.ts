import { describe, expect, it } from 'vitest';
import { focusEdges, LINKED_EDGE } from './edge-focus';

const edges = [
  { id: 'a', source: '1', target: '2' },
  { id: 'b', source: '2', target: '3' },
  { id: 'c', source: '4', target: '5' }
];

describe('le connessioni dei nodi selezionati restano accese', () => {
  it('ingressi e uscite di ogni nodo selezionato', () => {
    const out = focusEdges(edges, ['2'])!;
    expect(out.map((e) => e.class)).toEqual([LINKED_EDGE, LINKED_EDGE, undefined]);
  });

  it('senza selezione nessuna è accesa', () => {
    const lit = edges.map((e) => ({ ...e, class: LINKED_EDGE }));
    expect(focusEdges(lit, [])!.every((e) => e.class === undefined)).toBe(true);
  });

  it('restituisce null quando nulla cambia', () => {
    expect(focusEdges(edges, [])).toBeNull();
  });
});
