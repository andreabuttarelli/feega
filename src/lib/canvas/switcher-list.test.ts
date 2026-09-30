import { describe, expect, it } from 'vitest';
import { SEARCH_THRESHOLD, needsSearch, recentFirst, matching } from './switcher-list';

const row = (name: string, updatedAt: string) => ({ name, updatedAt });

describe('la lista dello switcher', () => {
  it('mette i progetti modificati di recente in cima', () => {
    const rows = [row('a', '2026-01-01'), row('b', '2026-03-01'), row('c', '2026-02-01')];
    expect(recentFirst(rows).map((r) => r.name)).toEqual(['b', 'c', 'a']);
  });

  it('non riordina la lista che riceve', () => {
    const rows = [row('a', '2026-01-01'), row('b', '2026-03-01')];
    recentFirst(rows);
    expect(rows[0].name).toBe('a');
  });

  it('filtra per nome senza badare a maiuscole e spazi', () => {
    const rows = [row('Spring launch', ''), row('Q4 ads', '')];
    expect(matching(rows, '  spring ').map((r) => r.name)).toEqual(['Spring launch']);
  });

  it('una ricerca vuota tiene tutto', () => {
    const rows = [row('a', ''), row('b', '')];
    expect(matching(rows, ' ')).toHaveLength(2);
  });

  it('la ricerca compare solo oltre la soglia', () => {
    expect(needsSearch(SEARCH_THRESHOLD)).toBe(false);
    expect(needsSearch(SEARCH_THRESHOLD + 1)).toBe(true);
  });
});
