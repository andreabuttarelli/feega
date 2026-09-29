import { describe, it, expect } from 'vitest';
import { leaveVerdict } from './chat-leave-guard';

const HERE = new URL('http://app/p/proj-1/c/canvas-1');

function to(path: string) {
  return new URL(`http://app${path}`);
}

describe('leaveVerdict', () => {
  it.each([
    ['la stessa pagina (invalidate, query)', '/p/proj-1/c/canvas-1?x=1', 'allow'],
    ['un\'altra tela dello stesso progetto', '/p/proj-1/c/canvas-2', 'allow'],
    ['la radice del progetto', '/p/proj-1', 'allow'],
    ['il calendario del progetto', '/p/proj-1/calendar', 'confirm'],
    ['le impostazioni del progetto', '/p/proj-1/settings', 'confirm'],
    ['un altro progetto', '/p/proj-2/c/canvas-9', 'confirm'],
    ['fuori dai progetti (logout, account)', '/logout', 'confirm']
  ] as const)('%s → %s', (_label, path, verdict) => {
    expect(leaveVerdict('proj-1', HERE, to(path))).toBe(verdict);
  });

  it('un altro sito non passa di qui: lo copre beforeunload', () => {
    expect(leaveVerdict('proj-1', HERE, new URL('https://example.com/'))).toBe('allow');
  });

  it('senza destinazione (chiusura della scheda) decide beforeunload, non il dialogo', () => {
    expect(leaveVerdict('proj-1', HERE, null)).toBe('allow');
  });
});
