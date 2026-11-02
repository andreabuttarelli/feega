import { describe, expect, it, vi } from 'vitest';
import { SNAP_REF, SnapMode, type PageTree } from './page-tree';
import { snapped } from './page-snaps';

const box = { x: 0, y: 0, width: 100, height: 100 };
const pictured = (ref: string) => ({ id: ref, type: 'RECTANGLE' as const, absoluteBoundingBox: box, fills: [{ type: 'IMAGE' as const, imageRef: `${SNAP_REF}${ref}` }] });
const TREE: PageTree = {
  title: 'Canvases',
  url: 'https://acme.test/',
  width: 1280,
  height: 900,
  truncated: false,
  root: { id: '0', type: 'FRAME', absoluteBoundingBox: box, children: [pictured('1'), pictured('2'), pictured('3')] },
  snaps: ['1', '2', '3'].map((ref) => ({ ref, box, mode: SnapMode.Isolated }))
};

describe('snapshots of a page tree', () => {
  it('stop before the browser session ends, keeping the pictures already taken (stripe on Browserless: the session was killed mid-snapshots and the whole read was lost)', async () => {
    const SESSION_LEFT_MS = [60_000, 1_000, 1_000];
    let taken = 0;
    const shoot = vi.fn(async () => `data:image/png;base64,${++taken}`);
    const left = vi.fn(() => SESSION_LEFT_MS[taken]);

    const tree = await snapped(TREE, shoot, left);

    expect(shoot).toHaveBeenCalledOnce();
    expect(tree.root.children?.map((c) => c.fills?.[0].imageRef)).toEqual(['data:image/png;base64,1']);
  });
});
