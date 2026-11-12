import { describe, expect, it } from 'vitest';
import { clipsOf, compOf, parseMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addBoards, AddRefusal } from '$lib/canvas/code-boards';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { freezeLayout } from '$lib/motion/layout/ops';
import { importCodeAt } from './import-code';
import { askOf } from './code-import.testkit';

async function imported(routes: string[]): Promise<MotionDoc> {
  const { ask, docs } = askOf({ routes });
  await importCodeAt(ask);
  return docs.get('frame-1')!.doc as MotionDoc;
}

const GEOMETRY = ['x', 'y', 'width', 'height'] as const;

function pixels(raw: MotionDoc, stored: MotionClip) {
  const doc = withAutoLayout(raw);
  const clip = clipsOf(doc).find((c) => c.id === stored.id)!;
  const scale = { x: doc.width, y: doc.height, width: doc.width, height: doc.height };
  const at = Object.fromEntries(GEOMETRY.flatMap((k) => (typeof clip.props[k] === 'number' ? [[k, Math.round((clip.props[k] as number) * scale[k] * 100) / 100]] : [])));
  const moved = Object.fromEntries((['x', 'y'] as const).flatMap((k) => (typeof clip.transform[k] === 'number' ? [[k, Math.round((clip.transform[k] as number) * scale[k] * 100) / 100]] : [])));
  const rest = Object.fromEntries(Object.entries(stored.props).filter(([k]) => !(GEOMETRY as readonly string[]).includes(k)));
  return { id: clip.id, name: clip.name, parent: clip.parent, component: clip.component, at, moved, rest };
}

const boardsOf = (doc: MotionDoc, parent: string | null) => clipsOf(doc).filter((c) => c.parent === parent && c.id !== 'surface');

const counter = () => {
  let n = 0;
  return () => `z${++n}`;
};

describe('adding pages to a frame imported from code', () => {
  it('leaves every board already on the frame where it is, pixel for pixel', async () => {
    const local = await imported(['/', '/settings']);
    const piece = await imported(['/pricing']);

    const added = addBoards(local, piece, ['n1'], 'n1', counter());

    expect(added.ok).toBe(true);
    const doc = (added as { doc: MotionDoc }).doc;
    const ground = 'n1';
    const before = clipsOf(local).filter((c) => c.id !== ground && c.id !== 'surface').map((c) => pixels(local, c));
    const after = clipsOf(doc).filter((c) => before.some((b) => b.id === c.id)).map((c) => pixels(doc, c));
    expect(after).toEqual(before);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('places the new board below the others, under the same ground, and grows the frame to hold it', async () => {
    const local = await imported(['/', '/settings']);
    const piece = await imported(['/pricing']);

    const added = addBoards(local, piece, ['n1'], 'n1', counter());

    const doc = (added as { doc: MotionDoc; boards: Record<string, string> }).doc;
    const board = clipsOf(doc).find((c) => c.id === (added as { boards: Record<string, string> }).boards.n1)!;
    expect(board.parent).toBe('n1');
    const top = ((board.props.y as number) - (board.props.height as number) / 2) * doc.height;
    expect(Math.round(top)).toBeGreaterThanOrEqual(local.height);
    expect(doc.height).toBeGreaterThan(local.height);
    expect(boardsOf(doc, 'n1')).toHaveLength(3);
  });

  it('reuses the mains already on the frame instead of adding a second Button', async () => {
    const local = await imported(['/', '/settings']);
    const piece = await imported(['/pricing']);
    const mains = (doc: MotionDoc) => Object.values(doc.comps).filter((c) => c.component).length;

    const added = addBoards(local, piece, ['n1'], 'n1', counter());

    const doc = (added as { doc: MotionDoc }).doc;
    expect(mains(doc)).toBe(mains(local));
    expect((added as { reused: number }).reused).toBe(2);
    const used = new Set(clipsOf(doc).flatMap((c) => compOf(c) ?? []));
    expect([...used].every((id) => local.comps[id])).toBe(true);
  });

  it('keeps an instance override pointing at the text inside the reused main', async () => {
    const local = await imported(['/', '/settings']);
    const piece = await imported(['/pricing']);

    const added = addBoards(local, piece, ['n1'], 'n1', counter());

    const doc = (added as { doc: MotionDoc }).doc;
    const cancel = clipsOf(doc).filter((c) => c.name === 'Cancel').at(-1)!;
    const main = doc.comps[compOf(cancel)!];
    const targets = new Set(main.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    expect(Object.keys(cancel.props.overrides as object).every((id) => targets.has(id))).toBe(true);
  });

  it('respects a board the user moved: it stays where they put it', async () => {
    const free = freezeLayout(await imported(['/', '/settings']), 'n1');
    const local = (free as { doc: MotionDoc }).doc;
    const moved = { ...local, tracks: local.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'n17' ? { ...c, props: { ...c.props, x: 0.2, y: 0.3 } } : c)) })) } as MotionDoc;
    const piece = await imported(['/pricing']);

    const added = addBoards(moved, piece, ['n1'], 'n1', counter());

    const doc = (added as { doc: MotionDoc }).doc;
    const settings = (d: MotionDoc) => pixels(d, clipsOf(d).find((c) => c.id === 'n17')!).at;
    expect(settings(doc)).toEqual(settings(moved));
  });

  it('refuses when the frame has no room left on its longest side', async () => {
    const local = await imported(['/', '/settings']);
    const tall = { ...local, height: 16_300 } as MotionDoc;
    const piece = await imported(['/pricing']);

    const added = addBoards(tall, piece, ['n1'], 'n1', counter());

    expect(added).toMatchObject({ ok: false, refusal: AddRefusal.Full });
  });

  it('moves the whole page with its board: each layer keeps its offset from the board', async () => {
    const local = await imported(['/', '/settings']);
    const piece = await imported(['/pricing', '/about']);

    const added = addBoards(local, piece, ['n2', 'n17'], 'n1', counter());

    const done = added as { doc: MotionDoc; boards: Record<string, string> };
    const offsets = (doc: MotionDoc, board: string) => {
      const laid = withAutoLayout(doc);
      const all = clipsOf(laid);
      const box = (c: MotionClip) => ({ x: Math.round(((c.props.x as number) - (c.props.width as number) / 2) * doc.width), y: Math.round(((c.props.y as number) - (c.props.height as number) / 2) * doc.height) });
      const origin = box(all.find((c) => c.id === board)!);
      return all.filter((c) => c.parent === board && typeof c.props.width === 'number').map((c) => ({ name: c.name, dx: box(c).x - origin.x, dy: box(c).y - origin.y }));
    };
    expect(offsets(done.doc, done.boards.n17)).toEqual(offsets(piece, 'n17'));
    expect(boardsOf(done.doc, 'n1')).toHaveLength(4);
  });
});
