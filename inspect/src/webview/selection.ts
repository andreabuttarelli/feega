import type { LayerNode, Source } from '../messages';

export type Ref = { source: Source; instance: number };

export type Selection = { refs: Ref[]; anchor: Ref | null };

export const NONE: Selection = { refs: [], anchor: null };

export const refOf = (source: Source, instance = 0): Ref => ({ source, instance });

const sourceKey = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export const keyOf = (r: Ref) => `${sourceKey(r.source)}#${r.instance}`;

export const primary = (sel: Selection): Ref | null => sel.refs.at(-1) ?? null;

export const contains = (sel: Selection, ref: Ref) => sel.refs.some((r) => keyOf(r) === keyOf(ref));

export const only = (ref: Ref): Selection => ({ refs: [ref], anchor: ref });

export function toggle(sel: Selection, ref: Ref): Selection {
  if (!contains(sel, ref)) {
    return { refs: [...sel.refs, ref], anchor: ref };
  }

  const refs = sel.refs.filter((r) => keyOf(r) !== keyOf(ref));
  return refs.length ? { refs, anchor: refs.at(-1)! } : NONE;
}

export function extend(sel: Selection, ref: Ref, rows: Ref[]): Selection {
  const keys = rows.map(keyOf);
  const from = keys.indexOf(sel.anchor ? keyOf(sel.anchor) : '');
  const to = keys.indexOf(keyOf(ref));
  if (from < 0 || to < 0) {
    return only(ref);
  }

  const span = rows.slice(Math.min(from, to), Math.max(from, to) + 1);
  return { refs: from <= to ? span : span.reverse(), anchor: sel.anchor };
}

const isOpen = (node: LayerNode, open: Record<string, boolean>) => Boolean(open[node.source ? sourceKey(node.source) : `group:${node.name}`]);

export function visibleRows(nodes: LayerNode[], open: Record<string, boolean>): Ref[] {
  return nodes.flatMap((node) => [...(node.source ? [refOf(node.source, node.instance)] : []), ...(isOpen(node, open) ? visibleRows(node.children, open) : [])]);
}

const refsOf = (nodes: LayerNode[]): Ref[] => nodes.flatMap((n) => (n.source ? [refOf(n.source, n.instance)] : []));

function levelOf(nodes: LayerNode[], ref: Ref): LayerNode[] | null {
  if (nodes.some((n) => n.source && keyOf(refOf(n.source, n.instance)) === keyOf(ref))) {
    return nodes;
  }

  for (const node of nodes) {
    const found = levelOf(node.children, ref);
    if (found) {
      return found;
    }
  }
  return null;
}

export function siblingsOf(tree: LayerNode[], ref: Ref): Ref[] {
  const level = levelOf(tree, ref);
  return level ? [...refsOf(level).filter((r) => keyOf(r) !== keyOf(ref)), ref] : [ref];
}

export enum Click {
  Single = 'single',
  Toggle = 'toggle',
  Range = 'range'
}

export enum Surface {
  Layers = 'layers',
  Preview = 'preview'
}

type Modifiers = { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };

export function clickOf(e: Modifiers, mac: boolean, surface: Surface): Click {
  if (mac ? e.metaKey : e.ctrlKey) {
    return Click.Toggle;
  }
  if (!e.shiftKey) {
    return Click.Single;
  }
  return surface === Surface.Layers ? Click.Range : Click.Toggle;
}
