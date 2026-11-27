import type { ComponentRow } from '../host/component-list';
import { keyOfComponent } from './components';

export enum NodeKind {
  Folder = 'folder',
  Component = 'component'
}

export type TreeNode = { kind: NodeKind.Folder; id: string; label: string; children: TreeNode[] } | { kind: NodeKind.Component; id: string; row: ComponentRow };

export type VisibleNode = { node: TreeNode; depth: number; parent: string | null };

type Branch = { folders: Map<string, Branch>; rows: ComponentRow[] };

const SEPARATOR = '/';

const normal = (query: string) => query.trim().toLowerCase();

const matches = (row: ComponentRow, needle: string) => row.name.toLowerCase().includes(needle) || row.folder.toLowerCase().includes(needle);

const branch = (): Branch => ({ folders: new Map(), rows: [] });

function place(root: Branch, row: ComponentRow) {
  let at = root;
  for (const part of row.folder.split(SEPARATOR).filter(Boolean)) {
    if (!at.folders.has(part)) {
      at.folders.set(part, branch());
    }
    at = at.folders.get(part)!;
  }
  at.rows.push(row);
}

const byName = (a: string, b: string) => a.localeCompare(b);

function folderNode(label: string, path: string, at: Branch): TreeNode {
  const [only] = at.folders;
  if (at.folders.size === 1 && at.rows.length === 0) {
    const [part, inner] = only;
    return folderNode(`${label}${SEPARATOR}${part}`, `${path}${SEPARATOR}${part}`, inner);
  }

  return { kind: NodeKind.Folder, id: path, label, children: childrenOf(path, at) };
}

function childrenOf(path: string, at: Branch): TreeNode[] {
  const folders = [...at.folders].sort(([a], [b]) => byName(a, b)).map(([part, inner]) => folderNode(part, path ? `${path}${SEPARATOR}${part}` : part, inner));
  const rows = [...at.rows].sort((a, b) => byName(a.name, b.name)).map((row): TreeNode => ({ kind: NodeKind.Component, id: keyOfComponent(row), row }));

  return [...folders, ...rows];
}

export function buildTree(rows: ComponentRow[], query: string): TreeNode[] {
  const needle = normal(query);
  const root = branch();

  for (const row of rows.filter((r) => matches(r, needle))) {
    place(root, row);
  }

  return childrenOf('', root);
}

export function visibleNodes(nodes: TreeNode[], open: ReadonlySet<string>, expandAll: boolean, depth = 0, parent: string | null = null): VisibleNode[] {
  return nodes.flatMap((node) => {
    const here: VisibleNode = { node, depth, parent };
    if (node.kind === NodeKind.Component || !(expandAll || open.has(node.id))) {
      return [here];
    }

    return [here, ...visibleNodes(node.children, open, expandAll, depth + 1, node.id)];
  });
}

export function highlight(text: string, query: string) {
  const needle = normal(query);
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) {
    return { before: text, hit: '', after: '' };
  }

  return { before: text.slice(0, at), hit: text.slice(at, at + needle.length), after: text.slice(at + needle.length) };
}
