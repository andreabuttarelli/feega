import { describe, expect, it } from 'vitest';
import { changeMatches } from './local-client';

const change = { table: 'nodes', eventType: 'INSERT', new: { id: 'n1', canvas_id: 'c1' }, old: {} };

describe('il browser locale filtra gli eventi come il realtime', () => {
  it('passa l’evento della propria tela', () => {
    expect(changeMatches({ event: '*', table: 'nodes', filter: 'canvas_id=eq.c1' }, change)).toBe(true);
  });

  it('scarta altre tabelle e altre tele', () => {
    expect(changeMatches({ event: '*', table: 'nodes_connections', filter: 'canvas_id=eq.c1' }, change)).toBe(false);
    expect(changeMatches({ event: '*', table: 'nodes', filter: 'canvas_id=eq.c2' }, change)).toBe(false);
  });

  it('una cancellazione si filtra sulla riga vecchia', () => {
    expect(changeMatches({ event: 'DELETE', table: 'nodes', filter: 'canvas_id=eq.c1' }, { ...change, eventType: 'DELETE', new: {}, old: { id: 'n1', canvas_id: 'c1' } })).toBe(true);
  });
});
