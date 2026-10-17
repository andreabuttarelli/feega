import { describe, expect, it } from 'vitest';
import { CANVAS_MENU, actionsIn, enabledFor, menuFor, shownFor } from './selection-actions';

describe('group and ungroup', () => {
  const box = { id: '1', type: 'motion', data: { kind: 'element' } };
  const group = { id: 'g', type: 'motion', data: { kind: 'group' } };
  const shown = (summaries: { id: string; type: string; data: Record<string, unknown> }[]) =>
    actionsIn('secondary', summaries.length).filter((a) => shownFor(a.id, summaries)).map((a) => a.id);

  it('offers Group from two picked things of any kind', () => {
    expect(shown([box, { id: '2', type: 'image', data: {} }])).toContain('group');
    expect(shown([box])).not.toContain('group');
  });

  it('offers Ungroup only when a group is picked', () => {
    expect(shown([group])).toContain('ungroup');
    expect(shown([box, { id: '2', type: 'text', data: {} }])).not.toContain('ungroup');
  });

  it('the context menu lists every edit with its shortcut', () => {
    expect(CANVAS_MENU.map((a) => [a.id, a.shortcut ?? null])).toEqual([
      ['group', 'Mod+G'],
      ['ungroup', 'Mod+Shift+G'],
      ['duplicate', 'Mod+D'],
      ['copy', 'Mod+C'],
      ['paste', 'Mod+V'],
      ['bring-front', 'Mod+]'],
      ['send-back', 'Mod+['],
      ['align-left', null],
      ['align-center', null],
      ['align-right', null],
      ['align-top', null],
      ['align-middle', null],
      ['align-bottom', null],
      ['flip-horizontal', 'Shift+H'],
      ['flip-vertical', 'Shift+V'],
      ['use-as-mask', 'Mod+Ctrl+M'],
      ['release-mask', null],
      ['delete', 'Backspace']
    ]);
  });

  it('each surface shows the shared menu, in its order, limited to what it can run', () => {
    expect(menuFor(new Set(['delete', 'group', 'align-left']), [box, group]).map((a) => a.id)).toEqual(['group', 'align-left', 'delete']);
  });
});

describe('la barra ha lo stesso ordine per ogni tipo di nodo', () => {
  it('secondarie, overflow e distruttive in gruppi fissi', () => {
    expect(actionsIn('secondary', 1).map((a) => a.id)).toEqual(['run-downstream', 'run-stale', 'connect-new', 'connect-existing', 'duplicate', 'ungroup']);
    expect(actionsIn('overflow', 1).map((a) => a.id)).toEqual(['copy-id', 'report']);
    expect(actionsIn('danger', 1).map((a) => a.id)).toEqual(['delete']);
  });

  it("eseguire il flusso è l'azione primaria solo con più nodi", () => {
    expect(actionsIn('primary', 1)).toEqual([]);
    expect(actionsIn('primary', 2).map((a) => a.id)).toEqual(['run-workflow']);
  });
});

describe('enabledFor', () => {
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
