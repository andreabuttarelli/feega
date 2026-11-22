import { describe, expect, it } from 'vitest';
import type { LayerNode, Source } from '../messages';
import { Click, NONE, Surface, clickOf, contains, extend, keyOf, only, primary, refOf, siblingsOf, toggle, visibleRows } from './selection';

const src = (line: number): Source => ({ file: 'a.svelte', line, col: 1 });
const ref = (line: number, instance = 0) => refOf(src(line), instance);
const lines = (refs: { source: Source }[]) => refs.map((r) => r.source.line);

const node = (line: number | null, children: LayerNode[] = [], name = `n${line}`): LayerNode => ({ name, tag: 'div', display: 'block', direction: 'column', position: 'static', source: line === null ? null : src(line), component: false, count: 1, instance: 0, children });

const OPEN_ROOT = { 'a.svelte:1:1': true };

const TREE = [node(1, [node(2), node(3, [node(4), node(5)]), node(6)]), node(7)];

describe('selection', () => {
  it('a plain pick selects one node and anchors on it', () => {
    const sel = only(ref(2));

    expect(lines(sel.refs)).toEqual([2]);
    expect(sel.anchor).toEqual(ref(2));
    expect(primary(sel)).toEqual(ref(2));
  });

  it('toggling adds a node and makes it the primary and the anchor', () => {
    const sel = toggle(only(ref(2)), ref(6));

    expect(lines(sel.refs)).toEqual([2, 6]);
    expect(primary(sel)).toEqual(ref(6));
    expect(sel.anchor).toEqual(ref(6));
  });

  it('toggling a selected node removes it and the last remaining becomes primary', () => {
    const sel = toggle(toggle(toggle(only(ref(2)), ref(3)), ref(6)), ref(6));

    expect(lines(sel.refs)).toEqual([2, 3]);
    expect(primary(sel)).toEqual(ref(3));
  });

  it('toggling the only node leaves nothing selected', () => {
    expect(toggle(only(ref(2)), ref(2))).toEqual(NONE);
  });

  it('the same source with another loop instance is another node', () => {
    const sel = toggle(only(ref(4, 0)), ref(4, 1));

    expect(sel.refs).toHaveLength(2);
    expect(contains(sel, ref(4, 1))).toBe(true);
    expect(contains(sel, ref(4, 2))).toBe(false);
    expect(keyOf(ref(4, 1))).not.toBe(keyOf(ref(4, 0)));
  });

  it('extending selects every visible row between the anchor and the clicked row', () => {
    const sel = extend(only(ref(2)), ref(6), visibleRows(TREE, OPEN_ROOT));

    expect(lines(sel.refs)).toEqual([2, 3, 6]);
    expect(primary(sel)).toEqual(ref(6));
    expect(sel.anchor).toEqual(ref(2));
  });

  it('extending upwards ends on the clicked row and keeps the anchor', () => {
    const rows = visibleRows(TREE, OPEN_ROOT);
    const sel = extend(only(ref(6)), ref(2), rows);

    expect(lines(rows)).toEqual([1, 2, 3, 6, 7]);
    expect(lines(sel.refs)).toEqual([6, 3, 2]);
    expect(primary(sel)).toEqual(ref(2));
    expect(sel.anchor).toEqual(ref(6));
  });

  it('extending twice re-ranges from the same anchor', () => {
    const rows = visibleRows(TREE, OPEN_ROOT);
    const first = extend(only(ref(2)), ref(6), rows);
    const second = extend(first, ref(3), rows);

    expect(lines(second.refs)).toEqual([2, 3]);
  });

  it('extending replaces whatever was selected before', () => {
    const sel = extend(toggle(only(ref(2)), ref(7)), ref(3), visibleRows(TREE, OPEN_ROOT));

    expect(lines(sel.refs)).toEqual([7, 6, 3]);
  });

  it('extending without an anchor, or from a collapsed row, falls back to a single pick', () => {
    const rows = visibleRows(TREE, {});

    expect(extend(NONE, ref(7), rows)).toEqual(only(ref(7)));
    expect(extend(only(ref(2)), ref(7), rows)).toEqual(only(ref(7)));
  });

  it('visible rows skip collapsed children and group nodes but go through open groups', () => {
    const tree = [node(1, [node(2)]), node(null, [node(3)], 'group'), node(4)];

    expect(lines(visibleRows(tree, {}))).toEqual([1, 4]);
    expect(lines(visibleRows(tree, { 'a.svelte:1:1': true, 'group:group': true }))).toEqual([1, 2, 3, 4]);
  });

  it('the siblings of a node are every node of its level, with the node itself last', () => {
    const siblings = siblingsOf(TREE, ref(3));

    expect(lines(siblings)).toEqual([2, 6, 3]);
  });

  it('the siblings of a root node are the roots', () => {
    expect(lines(siblingsOf(TREE, ref(7)))).toEqual([1, 7]);
  });

  it('a node that is not in the tree has no siblings but itself', () => {
    expect(lines(siblingsOf(TREE, ref(99)))).toEqual([99]);
  });
});

describe('clickOf', () => {
  const plain = { shiftKey: false, metaKey: false, ctrlKey: false };

  it('a plain click selects one node, in Layers and in the preview', () => {
    expect(clickOf(plain, true, Surface.Layers)).toBe(Click.Single);
    expect(clickOf(plain, true, Surface.Preview)).toBe(Click.Single);
  });

  it('⌘click toggles, and Ctrl+click does on other systems', () => {
    expect(clickOf({ ...plain, metaKey: true }, true, Surface.Layers)).toBe(Click.Toggle);
    expect(clickOf({ ...plain, ctrlKey: true }, false, Surface.Layers)).toBe(Click.Toggle);
    expect(clickOf({ ...plain, ctrlKey: true }, true, Surface.Layers)).toBe(Click.Single);
  });

  it('⇧click is a range in Layers and a toggle in the preview', () => {
    expect(clickOf({ ...plain, shiftKey: true }, true, Surface.Layers)).toBe(Click.Range);
    expect(clickOf({ ...plain, shiftKey: true }, true, Surface.Preview)).toBe(Click.Toggle);
  });
});
