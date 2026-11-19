import { describe, expect, it } from 'vitest';
import { emptyFolder, mergeFolders, relationOf, Relation, type Entity, type FolderDoc } from './index';

const withNodes = (nodes: Record<string, Entity>): FolderDoc => ({ ...emptyFolder(), collections: { ...emptyFolder().collections, nodes } });

const node = (id: string, fields: Partial<Entity> = {}): Entity => ({ id, version: 1, x: 0, y: 0, data: { text: 'base', color: 'red' }, ...fields });

describe('mergeFolders', () => {
  it('keeps edits made on different fields of the same node', () => {
    const base = withNodes({ a: node('a') });
    const ours = withNodes({ a: node('a', { version: 2, data: { text: 'mine', color: 'red' } }) });
    const theirs = withNodes({ a: node('a', { version: 2, data: { text: 'base', color: 'blue' }, x: 40 }) });

    const { doc, conflicts } = mergeFolders(base, ours, theirs);

    expect(doc.collections.nodes.a).toEqual({ id: 'a', version: 3, x: 40, y: 0, data: { text: 'mine', color: 'blue' } });
    expect(conflicts).toEqual([]);
  });

  it('keeps mine on the same field and records theirs', () => {
    const base = withNodes({ a: node('a') });
    const ours = withNodes({ a: node('a', { data: { text: 'mine', color: 'red' } }) });
    const theirs = withNodes({ a: node('a', { data: { text: 'theirs', color: 'red' } }) });

    const { doc, conflicts } = mergeFolders(base, ours, theirs);

    expect(doc.collections.nodes.a.data).toEqual({ text: 'mine', color: 'red' });
    expect(conflicts).toEqual([{ collection: 'nodes', id: 'a', field: 'data.text', base: 'base', ours: 'mine', theirs: 'theirs' }]);
    expect(doc.conflicts).toEqual(conflicts);
  });

  it('takes the same change from both sides without a conflict', () => {
    const base = withNodes({ a: node('a') });
    const both = withNodes({ a: node('a', { x: 9 }) });

    expect(mergeFolders(base, both, both)).toEqual({ doc: both, conflicts: [] });
  });

  it('adds what each side added', () => {
    const { doc } = mergeFolders(withNodes({}), withNodes({ a: node('a') }), withNodes({ b: node('b') }));

    expect(Object.keys(doc.collections.nodes).sort()).toEqual(['a', 'b']);
  });

  it('deletes what one side deleted and the other left alone', () => {
    const base = withNodes({ a: node('a'), b: node('b') });
    const { doc, conflicts } = mergeFolders(base, withNodes({ b: node('b') }), base);

    expect(Object.keys(doc.collections.nodes)).toEqual(['b']);
    expect(conflicts).toEqual([]);
  });

  it('keeps a node one side deleted and the other edited, and records the delete', () => {
    const base = withNodes({ a: node('a') });
    const edited = node('a', { x: 5 });

    const { doc, conflicts } = mergeFolders(base, withNodes({}), withNodes({ a: edited }));

    expect(doc.collections.nodes.a).toEqual(edited);
    expect(conflicts).toEqual([{ collection: 'nodes', id: 'a', field: '*', base: node('a'), ours: null, theirs: edited }]);
  });

  it('merges a node both sides added under the same id field by field', () => {
    const { doc, conflicts } = mergeFolders(withNodes({}), withNodes({ a: node('a', { x: 1 }) }), withNodes({ a: node('a', { x: 2 }) }));

    expect(doc.collections.nodes.a.x).toBe(1);
    expect(conflicts).toEqual([{ collection: 'nodes', id: 'a', field: 'x', base: null, ours: 1, theirs: 2 }]);
  });

  it('records a removed data field against an edit of it', () => {
    const base = withNodes({ a: node('a') });
    const { doc, conflicts } = mergeFolders(base, withNodes({ a: node('a', { data: { color: 'red' } }) }), withNodes({ a: node('a', { data: { text: 'new', color: 'red' } }) }));

    expect(doc.collections.nodes.a.data).toEqual({ color: 'red' });
    expect(conflicts[0]).toMatchObject({ field: 'data.text', ours: null, theirs: 'new' });
  });

  it('unions events by id', () => {
    const base = { ...emptyFolder(), events: [{ id: 1 }] };
    const { doc } = mergeFolders(base, { ...base, events: [{ id: 1 }, { id: 2 }] }, { ...base, events: [{ id: 1 }, { id: 3 }] });

    expect(doc.events).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('keeps conflict records still open on either side', () => {
    const open = { collection: 'nodes', id: 'z', field: 'x', base: 0, ours: 1, theirs: 2 };
    const base = { ...emptyFolder(), conflicts: [open] };

    expect(mergeFolders(base, base, emptyFolder()).doc.conflicts).toEqual([open]);
  });
});

describe('relationOf', () => {
  const base = withNodes({ a: node('a') });
  const changed = withNodes({ a: node('a', { x: 1 }) });

  it.each([
    [base, base, Relation.Same],
    [changed, base, Relation.Ahead],
    [base, changed, Relation.Behind],
    [changed, withNodes({}), Relation.Diverged]
  ])('names where ours and disk stand against the base', (ours, disk, expected) => {
    expect(relationOf(base, ours, disk)).toBe(expected);
  });

  it('calls equal changes on both sides the same', () => {
    expect(relationOf(base, changed, changed)).toBe(Relation.Same);
  });
});
