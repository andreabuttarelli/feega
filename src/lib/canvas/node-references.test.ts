import { describe, expect, it } from 'vitest';
import { referencesOf, toggleReference, removeReference, sameReference } from './node-references';
import { validateNodeData } from './node-data';

const GLOBAL = { source: 'catalogue', id: 'c1' } as const;
const OWN = { source: 'asset', id: 'a1' } as const;

describe('node references', () => {
  it('un nodo senza references ne ha zero', () => {
    expect(referencesOf({ prompt: 'x' })).toEqual([]);
  });

  it('legge solo le voci ben formate', () => {
    expect(referencesOf({ references: [GLOBAL, { source: 'x', id: 'y' }, 'z', OWN] })).toEqual([GLOBAL, OWN]);
  });

  it('toggle aggiunge in coda e toglie se già scelta', () => {
    const once = toggleReference([GLOBAL], OWN);
    expect(once).toEqual([GLOBAL, OWN]);
    expect(toggleReference(once, GLOBAL)).toEqual([OWN]);
  });

  it('remove toglie solo la voce indicata', () => {
    expect(removeReference([GLOBAL, OWN], GLOBAL)).toEqual([OWN]);
  });

  it('la stessa id in due sorgenti diverse non è la stessa voce', () => {
    expect(sameReference(GLOBAL, { source: 'asset', id: 'c1' })).toBe(false);
  });

  it('image e video accettano references; un nodo vecchio senza resta valido', () => {
    expect(validateNodeData('image', { prompt: 'x', references: [GLOBAL, OWN] }).ok).toBe(true);
    expect(validateNodeData('video', { prompt: 'x', references: [OWN] }).ok).toBe(true);
    expect(validateNodeData('image', { prompt: 'x' }).ok).toBe(true);
  });

  it('una sorgente sconosciuta è rifiutata', () => {
    expect(validateNodeData('image', { prompt: 'x', references: [{ source: 'web', id: 'a' }] }).ok).toBe(false);
  });
});
