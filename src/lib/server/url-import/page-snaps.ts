import type { RestNode } from '$lib/server/figma/rest-message';
import { SNAP_REF, type PageSnap, type PageTree } from './page-tree';

export type Shoot = (snap: PageSnap) => Promise<string | null>;

function swapped(node: RestNode, shots: Map<string, string>): RestNode | null {
  const ref = node.fills?.find((f) => f.imageRef?.startsWith(SNAP_REF))?.imageRef;
  if (ref) {
    const url = shots.get(ref.slice(SNAP_REF.length));
    return url ? { ...node, fills: node.fills!.map((f) => (f.imageRef === ref ? { ...f, imageRef: url } : f)) } : null;
  }
  if (!node.children) {
    return node;
  }
  return { ...node, children: node.children.flatMap((c) => swapped(c, shots) ?? []) };
}

export async function snapped(tree: PageTree, shoot: Shoot): Promise<PageTree> {
  const shots = new Map<string, string>();
  for (const snap of tree.snaps ?? []) {
    const url = await shoot(snap).catch(() => null);
    if (url) {
      shots.set(snap.ref, url);
    }
  }
  return { ...tree, root: swapped(tree.root, shots) ?? tree.root, snaps: [] };
}
