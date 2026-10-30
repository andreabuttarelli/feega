import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { boardsOf, BOARD_GAP, cropped } from './boards';

const WHITE = { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } };

const page = (title: string, width: number, height: number, children: RestNode[]): PageTree => ({
  title,
  url: `https://sb.vercel.run${title}`,
  width,
  height,
  truncated: false,
  fonts: [{ family: 'Inter', weight: '400', style: 'normal', url: 'https://f/inter.woff2' }],
  root: { id: 'r', type: 'FRAME', name: title, absoluteBoundingBox: { x: 0, y: 0, width, height }, fills: [WHITE], children }
});

const card = (use: number, x: number, y: number): RestNode => ({ id: `c${use}`, type: 'FRAME', use, absoluteBoundingBox: { x, y, width: 100, height: 40 } });

describe('boardsOf', () => {
  it('una rotta sola resta la pagina com\'è', () => {
    const one = page('/', 1280, 800, [card(0, 10, 10)]);

    expect(boardsOf('app', [{ label: '/', tree: one, uses: [{ component: 'Card', props: {} }] }])).toEqual({ tree: one, uses: [{ component: 'Card', props: {} }] });
  });

  it('più rotte stanno affiancate in un solo frame, ognuna col suo nome e i suoi usi rinumerati', () => {
    const made = boardsOf('app', [
      { label: '/', tree: page('Home', 1280, 800, [card(0, 10, 10)]), uses: [{ component: 'Card', props: {} }] },
      { label: '/settings', tree: page('Settings', 1280, 1200, [card(0, 20, 30), card(1, 20, 90)]), uses: [{ component: 'Card', props: {} }, { component: 'Button', props: {}, shares: 0 }] }
    ]);

    const [home, settings] = made.tree.root.children!;
    expect(made.tree.root.absoluteBoundingBox).toEqual({ x: 0, y: 0, width: 1280 * 2 + BOARD_GAP * 3, height: 1200 + BOARD_GAP * 2 });
    expect(home).toMatchObject({ name: '/', absoluteBoundingBox: { x: BOARD_GAP, y: BOARD_GAP } });
    expect(settings).toMatchObject({ name: '/settings', absoluteBoundingBox: { x: BOARD_GAP * 2 + 1280, y: BOARD_GAP } });
    expect(settings.children!.map((c) => [c.use, c.absoluteBoundingBox!.x])).toEqual([
      [1, BOARD_GAP * 2 + 1280 + 20],
      [2, BOARD_GAP * 2 + 1280 + 20]
    ]);
    expect(made.uses.map((u) => u.shares)).toEqual([undefined, undefined, 1]);
    expect(made.tree.fonts).toHaveLength(1);
    expect(made.tree.title).toBe('app');
  });

  it('le tavole vanno a capo prima di superare il lato massimo di un frame', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ label: `/r${i}`, tree: page(`R${i}`, 1280, 800, []), uses: [] }));
    const made = boardsOf('app', many);

    expect(made.tree.root.absoluteBoundingBox!.width).toBeLessThanOrEqual(16384);
    expect(new Set(made.tree.root.children!.map((b) => b.absoluteBoundingBox!.y)).size).toBe(2);
  });
});

describe('cropped', () => {
  it('una storia si ritaglia attorno a quello che disegna, con un margine', () => {
    const story = page('Button', 1280, 800, [card(0, 400, 300)]);
    const made = cropped(story, 16);

    expect(made.root.absoluteBoundingBox).toEqual({ x: 0, y: 0, width: 132, height: 72 });
    expect(made.root.children![0].absoluteBoundingBox).toMatchObject({ x: 16, y: 16 });
    expect([made.width, made.height]).toEqual([132, 72]);
  });

  it('una storia vuota resta com\'è', () => {
    const empty = page('Empty', 1280, 800, []);

    expect(cropped(empty, 16)).toEqual(empty);
  });
});
