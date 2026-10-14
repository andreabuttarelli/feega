import { describe, expect, it } from 'vitest';
import { actionsIn, enabledFor } from './selection-actions';

describe('la barra ha lo stesso ordine per ogni tipo di nodo', () => {
  it('secondarie, overflow e distruttive in gruppi fissi', () => {
    expect(actionsIn('secondary', 1).map((a) => a.id)).toEqual(['run-downstream', 'run-stale', 'connect-new', 'connect-existing', 'duplicate', 'promote']);
    expect(actionsIn('overflow', 1).map((a) => a.id)).toEqual(['copy-id', 'report']);
    expect(actionsIn('danger', 1).map((a) => a.id)).toEqual(['delete']);
  });

  it("eseguire il flusso è l'azione primaria solo con più nodi", () => {
    expect(actionsIn('primary', 1)).toEqual([]);
    expect(actionsIn('primary', 2).map((a) => a.id)).toEqual(['run-workflow']);
  });
});

describe('enabledFor', () => {
  it('promote è abilitata con un\'immagine nella selezione', () => {
    const result = enabledFor('promote', [{ id: '1', type: 'image', data: { refId: 'a1' } }]);
    expect(result.enabled).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('promote è disabilitata senza media né testo, e dà una ragione', () => {
    const result = enabledFor('promote', [{ id: '1', type: 'iframe', data: { url: 'x' } }]);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('Select at least one media or text node');
  });

  it('duplicate è sempre abilitata, indipendentemente dal contenuto', () => {
    expect(enabledFor('duplicate', []).enabled).toBe(true);
    expect(enabledFor('duplicate', [{ id: '1', type: 'text', data: {} }]).enabled).toBe(true);
  });

  it('run-workflow è abilitata su due nodi testo collegati', () => {
    const nodes = [
      { id: '1', type: 'text', data: {} },
      { id: '2', type: 'text', data: {} }
    ];
    const edges = [{ sourceNodeId: '1', targetNodeId: '2' }];
    const result = enabledFor('run-workflow', nodes, edges);
    expect(result.enabled).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('run-workflow è disabilitata su due nodi non collegati, e dà la ragione di planWorkflow', () => {
    const nodes = [
      { id: '1', type: 'text', data: {} },
      { id: '2', type: 'text', data: {} }
    ];
    const result = enabledFor('run-workflow', nodes, []);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('The selected nodes are not all connected');
  });

  it('run-downstream needs exactly one node that runs or feeds something', () => {
    const edges = [{ sourceNodeId: 'd', targetNodeId: '2' }];
    expect(enabledFor('run-downstream', [{ id: '1', type: 'image', data: {} }]).enabled).toBe(true);
    expect(enabledFor('run-downstream', [{ id: 'd', type: 'doc', data: {} }], edges).enabled).toBe(true);
    expect(enabledFor('run-downstream', [{ id: 'x', type: 'doc', data: {} }], edges)).toEqual({ enabled: false, reason: 'Nothing runs from here' });
    expect(enabledFor('run-downstream', [{ id: '1', type: 'image', data: {} }, { id: '2', type: 'text', data: {} }]).enabled).toBe(false);
  });

  it('run-stale needs a stale node in the selection', () => {
    const nodes = [{ id: '1', type: 'image', data: {} }];
    expect(enabledFor('run-stale', nodes, [], ['1']).enabled).toBe(true);
    expect(enabledFor('run-stale', nodes, [], ['2'])).toEqual({ enabled: false, reason: 'Nothing here is out of date' });
  });
});
