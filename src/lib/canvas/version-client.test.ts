import { describe, expect, it } from 'vitest';
import { timelineOf } from './version-client';

const commits = [
  { sha: 'c3', message: 'Three', author: 'A', at: '2026-11-03' },
  { sha: 'c2', message: 'Two', author: 'A', at: '2026-11-02' },
  { sha: 'c1', message: 'One', author: 'A', at: '2026-11-01' }
];

describe('la timeline di una versione', () => {
  it('va dal commit più vecchio al più recente, e punta a quello mostrato', () => {
    const line = timelineOf(commits, 'c2');

    expect(line.steps.map((s) => s.sha)).toEqual(['c1', 'c2', 'c3']);
    expect(line.at).toBe(1);
  });

  it('una versione fuori dalla storia punta all’ultimo commit', () => {
    expect(timelineOf(commits, 'zz').at).toBe(2);
  });
});
