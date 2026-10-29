import { describe, expect, it } from 'vitest';
import { FRAME_DIALOG_ACTIONS } from './frame-dialogs';
import { CANVAS_MENU, SELECTION_ACTIONS, actionsIn, enabledFor, menuFor, shownFor, toolbarSlots } from './selection-actions';

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
      ['create-formats', null],
      ['combine-video', null],
      ['export', null],
      ['copy', 'Mod+C'],
      ['paste', 'Mod+V'],
      ['copy-properties', 'Mod+Alt+C'],
      ['paste-properties', 'Mod+Alt+V'],
      ['bring-front', 'Mod+]'],
      ['send-back', 'Mod+['],
      ['align-left', 'Alt+A'],
      ['align-center', 'Alt+H'],
      ['align-right', 'Alt+D'],
      ['align-top', 'Alt+W'],
      ['align-middle', 'Alt+V'],
      ['align-bottom', 'Alt+S'],
      ['tidy-up', 'Mod+Alt+T'],
      ['stack', 'Shift+A'],
      ['section-selection', 'Shift+S'],
      ['run-technique-rows', null],
      ['edit-technique', null],
      ['detach-technique', null],
      ['save-technique', null],
      ['flip-horizontal', 'Shift+H'],
      ['flip-vertical', 'Shift+V'],
      ['use-as-mask', 'Mod+Ctrl+M'],
      ['release-mask', null],
      ['select-matching', 'Mod+Alt+A'],
      ['select-same-fill', null],
      ['select-same-stroke', null],
      ['select-same-font', null],
      ['select-same-effect', null],
      ['frame-selection', 'Mod+Alt+G'],
      ['resize-to-fit', 'Mod+Alt+Shift+R'],
      ['auto-layout', 'Shift+A'],
      ['union', 'Alt+Shift+U'],
      ['subtract', 'Alt+Shift+S'],
      ['intersect', 'Alt+Shift+I'],
      ['exclude', 'Alt+Shift+E'],
      ['flatten', 'Mod+E'],
      ['outline-stroke', 'Mod+Alt+O'],
      ['outline-text', 'Mod+Shift+O'],
      ['create-component', 'Mod+Alt+K'],
      ['detach-instance', null],
      ['push-instance', null],
      ['reset-instance', null],
      ['hide', 'Mod+Shift+H'],
      ['lock', 'Mod+Shift+L'],
      ['delete', 'Backspace']
    ]);
  });

  it('offers Export for any picked frames, one or many, and nothing else', () => {
    const frame = { type: 'motion', data: { format: '4:5' } };
    expect(shownFor('export', [frame])).toBe(true);
    expect(shownFor('export', [frame, frame])).toBe(true);
    expect(shownFor('export', [frame, { type: 'image', data: {} }])).toBe(false);
    expect(shownFor('export', [{ type: 'motion', data: { format: '1:1', kind: 'element' } }]), 'a free element exports on its own').toBe(true);
  });

  it('offers reframe on one image or video that has a result, and nowhere else', () => {
    for (const type of ['image', 'video']) {
      expect(shownFor('reframe', [{ type, data: { refId: 'a1' } }])).toBe(true);
      expect(shownFor('reframe', [{ type, data: {} }])).toBe(false);
      expect(shownFor('reframe', [{ type, data: { refId: 'a1' } }, { type, data: { refId: 'a1' } }])).toBe(false);
    }
    expect(shownFor('reframe', [{ type: 'text', data: { refId: 'a1' } }])).toBe(false);
  });

  it('offers the image tools on one image that has a result, and nowhere else', () => {
    const done = { type: 'image', data: { refId: 'a1' } };
    for (const id of ['remove-background', 'upscale-image', 'inpaint', 'outpaint', 'split-layers'] as const) {
      expect(shownFor(id, [done])).toBe(true);
      expect(shownFor(id, [done, done])).toBe(false);
      expect(shownFor(id, [{ type: 'image', data: {} }])).toBe(false);
      expect(shownFor(id, [{ type: 'video', data: { refId: 'a1' } }])).toBe(false);
    }
  });

  it('offers the image tools on an uploaded image that holds only an asset', () => {
    for (const id of ['remove-background', 'upscale-image', 'inpaint', 'outpaint', 'reframe', 'split-layers'] as const) {
      expect(shownFor(id, [{ type: 'image', data: { assetId: 'up1' } }])).toBe(true);
    }
  });

  it('offers Layers to frame only on an image that was split into layers', () => {
    const split = { type: 'image', data: { refId: 'a1', layerRefIds: ['l1', 'l2'] } };

    expect(shownFor('layers-to-frame', [split])).toBe(true);
    expect(shownFor('layers-to-frame', [{ type: 'image', data: { refId: 'a1' } }])).toBe(false);
    expect(shownFor('layers-to-frame', [{ type: 'image', data: { refId: 'a1', layerRefIds: [] } }])).toBe(false);
    expect(shownFor('layers-to-frame', [split, split])).toBe(false);
  });

  it('reads an element node as a free element whatever its data holds', () => {
    const element = { type: 'element', data: { docHeadRevision: 1 } };
    expect(shownFor('export', [element])).toBe(true);
    expect(shownFor('create-formats', [element])).toBe(false);
    expect(shownFor('ungroup', [{ type: 'element', data: { docHeadRevision: 1, kind: 'group' } }])).toBe(true);
  });

  it('each surface shows the shared menu, in its order, limited to what it can run', () => {
    expect(menuFor(new Set(['delete', 'group', 'align-left']), [box, group]).map((a) => a.id)).toEqual(['group', 'align-left', 'delete']);
  });
});

describe('la barra ha lo stesso ordine per ogni tipo di nodo', () => {
  it('secondarie, overflow e distruttive in gruppi fissi', () => {
    expect(actionsIn('secondary', 1).map((a) => a.id)).toEqual(['run-technique', 'run-downstream', 'run-stale', 'connect-new', 'connect-existing', 'duplicate', 'ungroup', 'remove-background', 'upscale-image', 'inpaint', 'outpaint', 'reframe', 'split-layers', 'layers-to-frame']);
    expect(actionsIn('overflow', 1).map((a) => a.id)).toEqual(['export', 'frame-code', ...Object.keys(FRAME_DIALOG_ACTIONS), 'copy-id', 'report']);
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

  it('shows the technique actions for one technique node only', () => {
    const technique = { type: 'technique', data: {} };

    expect(shownFor('run-technique', [technique])).toBe(true);
    expect(shownFor('detach-technique', [technique])).toBe(true);
    expect(shownFor('edit-technique', [technique, technique])).toBe(false);
    expect(shownFor('run-technique-rows', [technique])).toBe(true);
    expect(shownFor('run-technique-rows', [technique, technique])).toBe(false);
    expect(shownFor('run-technique', [{ type: 'text', data: {} }])).toBe(false);
  });

  it('save-technique takes a connected flow of any node types and says why not otherwise', () => {
    const nodes = [
      { id: '1', type: 'text', data: {} },
      { id: 'd', type: 'doc', data: {} }
    ];

    expect(enabledFor('save-technique', nodes, [{ sourceNodeId: '1', targetNodeId: 'd' }]).enabled).toBe(true);
    expect(enabledFor('save-technique', nodes, [])).toEqual({ enabled: false, reason: 'The selected nodes are not all connected' });
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

describe('create formats', () => {
  const frame = { type: 'motion', data: { format: '16:9' } };

  it('shows for one frame', () => {
    expect(shownFor('create-formats', [frame])).toBe(true);
    expect(CANVAS_MENU.map((a) => a.id)).toContain('create-formats');
  });

  it('hides for anything else', () => {
    expect(shownFor('create-formats', [frame, frame])).toBe(false);
    expect(shownFor('create-formats', [{ type: 'motion', data: { format: '16:9', kind: 'element' } }])).toBe(false);
    expect(shownFor('create-formats', [{ type: 'text', data: { prompt: 'x' } }])).toBe(false);
  });
});

describe('combine into video', () => {
  const frame = { type: 'motion', data: { format: '16:9' } };

  it('is offered on two or more frames only', () => {
    expect(shownFor('combine-video', [frame, frame])).toBe(true);
    expect(shownFor('combine-video', [frame])).toBe(false);
    expect(shownFor('combine-video', [frame, { type: 'motion', data: { format: '16:9', kind: 'element' } }])).toBe(false);
    expect(CANVAS_MENU.map((a) => a.id)).toContain('combine-video');
  });
});

describe('the selection bar shows a few actions and folds the rest', () => {
  const byId = (ids: string[]) => SELECTION_ACTIONS.filter((a) => ids.includes(a.id));

  it('pins the most used actions in priority order and moves the rest to the overflow, delete last', () => {
    const slots = toolbarSlots(byId(['upscale-image', 'connect-new', 'duplicate', 'run-downstream', 'remove-background', 'export', 'delete']));

    expect(slots.pinned.map((a) => a.id)).toEqual(['duplicate', 'run-downstream', 'upscale-image']);
    expect(slots.overflow.map((a) => a.id)).toEqual(['remove-background', 'connect-new', 'export']);
    expect(slots.danger.map((a) => a.id)).toEqual(['delete']);
  });

  it('keeps copy link as a fixed icon and also lists it in the overflow', () => {
    const slots = toolbarSlots(byId(['copy-link', 'duplicate', 'export', 'delete']));

    expect(slots.fixed.map((a) => a.id)).toEqual(['copy-link']);
    expect(slots.pinned.map((a) => a.id)).toEqual(['duplicate']);
    expect(slots.overflow.map((a) => a.id)).toEqual(['copy-link', 'export']);
  });
});

describe('editor modes: the context menu reaches every layer op', () => {
  it('lists instance ops, hide, lock and copy/paste properties in its order', () => {
    const ids: string[] = CANVAS_MENU.map((a) => a.id);

    for (const id of ['create-component', 'detach-instance', 'push-instance', 'reset-instance', 'hide', 'lock', 'copy-properties', 'paste-properties']) {
      expect(ids).toContain(id);
    }
  });
});
