import { DESIGN_MAX_SIDE } from '@feega/motion-core/motion/doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageFont, PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';

export const BOARD_GAP = 160;

const GROUND = { type: 'SOLID', color: { r: 0.953, g: 0.953, b: 0.957, a: 1 } };

export type Capture = { label: string; tree: PageTree; uses: ComponentUse[] };

export type Marked = { tree: PageTree; uses: ComponentUse[] };

type Offset = { x: number; y: number; use: number; prefix: string };

function moved(node: RestNode, by: Offset): RestNode {
  const b = node.absoluteBoundingBox;
  return {
    ...node,
    id: `${by.prefix}${node.id}`,
    ...(b ? { absoluteBoundingBox: { ...b, x: b.x + by.x, y: b.y + by.y } } : {}),
    ...(node.use === undefined ? {} : { use: node.use + by.use }),
    ...(node.children ? { children: node.children.map((c) => moved(c, by)) } : {})
  };
}

type Placed = { capture: Capture; x: number; y: number };

function shelved(captures: Capture[]): { placed: Placed[]; width: number; height: number } {
  const placed: Placed[] = [];
  let [x, y, row, width] = [BOARD_GAP, BOARD_GAP, 0, 0];
  for (const capture of captures) {
    const { width: w, height: h } = capture.tree.root.absoluteBoundingBox!;
    if (x > BOARD_GAP && x + w + BOARD_GAP > DESIGN_MAX_SIDE) {
      [x, y, row] = [BOARD_GAP, y + row + BOARD_GAP, 0];
    }
    placed.push({ capture, x, y });
    width = Math.max(width, x + w + BOARD_GAP);
    row = Math.max(row, h);
    x += w + BOARD_GAP;
  }
  return { placed, width, height: y + row + BOARD_GAP };
}

const fontKey = (f: PageFont) => `${f.family}|${f.weight}|${f.style}|${f.url}`;

export function boardsOf(name: string, captures: Capture[]): Marked {
  if (captures.length === 1) {
    return { tree: captures[0].tree, uses: captures[0].uses };
  }

  const { placed, width, height } = shelved(captures);
  const uses: ComponentUse[] = [];
  const boards = placed.map(({ capture, x, y }, i) => {
    const by = { x, y, use: uses.length, prefix: `${i}-` };
    uses.push(...capture.uses.map((u) => (u.shares === undefined ? u : { ...u, shares: u.shares + by.use })));
    return { ...moved(capture.tree.root, by), name: capture.label };
  });

  const fonts = [...new Map(captures.flatMap((c) => c.tree.fonts ?? []).map((f) => [fontKey(f), f])).values()];
  const root: RestNode = { id: 'boards', type: 'FRAME', name, absoluteBoundingBox: { x: 0, y: 0, width, height }, fills: [GROUND], clipsContent: true, children: boards };
  return { tree: { title: name, url: captures[0].tree.url, width, height, truncated: captures.some((c) => c.tree.truncated), fonts, root }, uses };
}

type Extent = { left: number; top: number; right: number; bottom: number };

function extentOf(nodes: RestNode[]): Extent | null {
  const boxes = nodes.flatMap((n) => (n.absoluteBoundingBox ? [n.absoluteBoundingBox] : []));
  if (!boxes.length) {
    return null;
  }
  return { left: Math.min(...boxes.map((b) => b.x)), top: Math.min(...boxes.map((b) => b.y)), right: Math.max(...boxes.map((b) => b.x + b.width)), bottom: Math.max(...boxes.map((b) => b.y + b.height)) };
}

export function cropped(tree: PageTree, margin: number): PageTree {
  const extent = extentOf(tree.root.children ?? []);
  if (!extent) {
    return tree;
  }
  const [width, height] = [Math.ceil(extent.right - extent.left + margin * 2), Math.ceil(extent.bottom - extent.top + margin * 2)];
  const by = { x: margin - extent.left, y: margin - extent.top, use: 0, prefix: '' };
  const children = (tree.root.children ?? []).map((c) => moved(c, by));
  return { ...tree, width, height, root: { ...tree.root, absoluteBoundingBox: { x: 0, y: 0, width, height }, children } };
}
