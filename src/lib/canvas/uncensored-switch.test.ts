import { describe, it, expect } from 'vitest';
import { needsUncensoredConfirm } from './uncensored-switch';

describe('needsUncensoredConfirm — passare a un modello uncensored con roba collegata chiede conferma', () => {
  it('nessuna conferma se il modello scelto non è uncensored', () => {
    expect(needsUncensoredConfirm({ nextUncensored: false, hasIncomingEdges: true, hasReferences: true })).toBe(false);
  });

  it('nessuna conferma su un modello uncensored senza archi né referenze', () => {
    expect(needsUncensoredConfirm({ nextUncensored: true, hasIncomingEdges: false, hasReferences: false })).toBe(false);
  });

  it('conferma richiesta: uncensored con un arco entrante', () => {
    expect(needsUncensoredConfirm({ nextUncensored: true, hasIncomingEdges: true, hasReferences: false })).toBe(true);
  });

  it('conferma richiesta: uncensored con referenze scelte', () => {
    expect(needsUncensoredConfirm({ nextUncensored: true, hasIncomingEdges: false, hasReferences: true })).toBe(true);
  });

  it('conferma richiesta: uncensored con entrambi', () => {
    expect(needsUncensoredConfirm({ nextUncensored: true, hasIncomingEdges: true, hasReferences: true })).toBe(true);
  });
});
