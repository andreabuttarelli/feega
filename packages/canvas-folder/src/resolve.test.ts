import { describe, expect, it } from 'vitest';
import { emptyFolder, Keep, resolveConflict, type Conflict, type Entity, type FolderDoc } from './index';

const withNode = (node: Entity | null, conflicts: Conflict[]): FolderDoc => ({ ...emptyFolder(), collections: { ...emptyFolder().collections, nodes: node ? { a: node } : {} }, conflicts });

const textConflict: Conflict = { collection: 'nodes', id: 'a', field: 'data.text', base: 'base', ours: 'mine', theirs: 'theirs' };

describe('resolveConflict', () => {
  it('keeps mine by closing the record', () => {
    const doc = withNode({ id: 'a', version: 2, data: { text: 'mine' } }, [textConflict]);

    expect(resolveConflict(doc, textConflict, Keep.Mine)).toEqual(withNode({ id: 'a', version: 2, data: { text: 'mine' } }, []));
  });

  it('keeps theirs by writing their value into the field and bumping the version', () => {
    const doc = withNode({ id: 'a', version: 2, data: { text: 'mine', color: 'red' } }, [textConflict]);

    expect(resolveConflict(doc, textConflict, Keep.Theirs)).toEqual(withNode({ id: 'a', version: 3, data: { text: 'theirs', color: 'red' } }, []));
  });

  it('keeps their deletion of a whole node', () => {
    const conflict: Conflict = { collection: 'nodes', id: 'a', field: '*', base: { id: 'a' }, ours: { id: 'a', x: 1 }, theirs: null };

    expect(resolveConflict(withNode({ id: 'a', x: 1 }, [conflict]), conflict, Keep.Theirs)).toEqual(withNode(null, []));
  });

  it('removes a field their side removed', () => {
    const conflict: Conflict = { ...textConflict, theirs: null };

    expect(resolveConflict(withNode({ id: 'a', version: 1, data: { text: 'mine' } }, [conflict]), conflict, Keep.Theirs).collections.nodes.a).toEqual({ id: 'a', version: 2, data: {} });
  });

  it('applies a canvas field conflict to the canvas', () => {
    const conflict: Conflict = { collection: 'canvas', id: 'canvas', field: 'canvasName', base: 'a', ours: 'b', theirs: 'c' };

    expect(resolveConflict({ ...emptyFolder(), canvas: { canvasName: 'b' }, conflicts: [conflict] }, conflict, Keep.Theirs).canvas).toEqual({ canvasName: 'c' });
  });
});
