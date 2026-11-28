import { describe, expect, it } from 'vitest';
import { CANVAS_COLUMNS, COLUMN_GAP, COMPACT_HEIGHT, DEFAULT_CELL, FLOW_GAP_X, FLOW_GAP_Y, GROUP_GAP, HEIGHT_CAP_FACTOR, MAX_CELL, MIN_CELL, ROW_GAP, ROW_HEAD, ROW_WIDTH, columnsFor, groupWidth, layoutCanvas, layoutFlow } from './canvas-layout';
import { Size, SIZES } from './sizes';

describe('layoutFlow', () => {
  const sized = (key: string, width: number, height: number) => ({ key, name: key.toUpperCase(), size: { width, height } });

  it('puts a frame without a measured size in a default cell', () => {
    const { frames } = layoutFlow([{ key: 'a', name: 'A' }], ROW_WIDTH);

    expect(frames[0]).toMatchObject({ width: DEFAULT_CELL.width, height: DEFAULT_CELL.height, x: 0, y: 0 });
  });

  it('sizes a frame to its component, clamped to the minimum and maximum', () => {
    const { frames } = layoutFlow([sized('a', 300, 120), sized('b', 20, 10), sized('c', 9000, 9000)], ROW_WIDTH * 10);

    expect(frames.map((f) => [f.width, f.height])).toEqual([[300, 120], [MIN_CELL.width, MIN_CELL.height], [MAX_CELL.width, MAX_CELL.height]]);
  });

  it('flows left to right and starts a new row when the next one does not fit', () => {
    const { frames } = layoutFlow([sized('a', 600, 200), sized('b', 600, 100), sized('c', 600, 100)], 1400);

    expect(frames[1].x).toBe(600 + FLOW_GAP_X);
    expect([frames[2].x, frames[2].y]).toEqual([0, 200 + FLOW_GAP_Y]);
  });

  it('lets a row be as tall as its tallest frame', () => {
    const { frames } = layoutFlow([sized('a', 600, 200), sized('b', 600, 500), sized('c', 600, 100)], 1400);

    expect(frames[2].y).toBe(500 + FLOW_GAP_Y);
  });

  it('puts a frame wider than the row alone on its row', () => {
    const { frames } = layoutFlow([sized('a', 200, 100), sized('b', 1200, 100)], 800);

    expect(frames[1]).toMatchObject({ x: 0, y: 100 + FLOW_GAP_Y });
  });

  it('carries the name and opens the frame by its key', () => {
    expect(layoutFlow([sized('a', 300, 100)], ROW_WIDTH).frames.map((f) => [f.name, f.target])).toEqual([['A', 'a']]);
  });

  it('bounds wrap the frames', () => {
    const { frames, bounds } = layoutFlow([sized('a', 600, 200), sized('b', 600, 100), sized('c', 600, 100)], 1400);

    expect(bounds).toEqual({ x: 0, y: 0, width: frames[1].x + frames[1].width, height: frames[2].y + frames[2].height });
  });

  it('is empty without items', () => {
    expect(layoutFlow([], ROW_WIDTH)).toEqual({ frames: [], bounds: { x: 0, y: 0, width: 0, height: 0 } });
  });
});

const pages = [
  { route: '/', dynamic: false },
  { route: '/about', dynamic: false },
  { route: '/blog/[slug]', dynamic: true }
];

describe('the columns are the responsive sizes', () => {
  it('goes desktop, tablet, phone', () => {
    expect(CANVAS_COLUMNS).toEqual([Size.Desktop, Size.Tablet, Size.Phone]);
  });
});

describe('layoutCanvas', () => {
  const { frames, rows } = layoutCanvas(pages, CANVAS_COLUMNS);

  it('gives every page one frame per size', () => {
    expect(frames).toHaveLength(9);
    expect(frames.filter((f) => f.route === '/about').map((f) => f.size)).toEqual(CANVAS_COLUMNS);
  });

  it('sizes a frame like its device', () => {
    expect(frames[0]).toMatchObject({ width: 1440, height: 900 });
    expect(frames[1]).toMatchObject({ width: 768, height: 1024 });
    expect(frames[2]).toMatchObject({ width: 390, height: 844 });
  });

  it('places the sizes of a page side by side, tops aligned', () => {
    const row = frames.slice(0, 3);

    expect(row[1].x).toBe(row[0].x + row[0].width + COLUMN_GAP);
    expect(row[2].x).toBe(row[1].x + row[1].width + COLUMN_GAP);
    expect(new Set(row.map((f) => f.y)).size).toBe(1);
    expect(row[0].y).toBe(rows[0].y + ROW_HEAD);
  });

  it('stacks one row per page, in order, below the tallest frame', () => {
    expect(rows.map((r) => r.route)).toEqual(['/', '/about', '/blog/[slug]']);
    expect(rows[0].height).toBe(ROW_HEAD + 1024);
    expect(rows[1].y).toBe(rows[0].y + rows[0].height + ROW_GAP);
  });

  it('marks dynamic routes on the row and on every frame', () => {
    expect(rows[2].dynamic).toBe(true);
    expect(frames.filter((f) => f.dynamic).map((f) => f.route)).toEqual(['/blog/[slug]', '/blog/[slug]', '/blog/[slug]']);
  });

  it('keys each frame by route and size', () => {
    expect(frames[1].key).toBe('/::tablet');
  });
});

describe('a dynamic route with examples', () => {
  const withExample = layoutCanvas([{ route: '/blog/[slug]', dynamic: true, examples: [{ path: '/blog/primo-post', label: 'primo-post' }, { path: '/blog/b', label: 'b' }] }], CANVAS_COLUMNS);

  it('shows its first example on every frame and on the row', () => {
    expect(withExample.frames.map((f) => f.target)).toEqual(['/blog/primo-post', '/blog/primo-post', '/blog/primo-post']);
    expect(withExample.rows[0].example).toEqual({ path: '/blog/primo-post', label: 'primo-post' });
  });

  it('without examples keeps a placeholder', () => {
    const empty = layoutCanvas([{ route: '/blog/[slug]', dynamic: true, examples: [] }], CANVAS_COLUMNS);

    expect(empty.frames.map((f) => f.target)).toEqual([null, null, null]);
    expect(empty.rows[0].example).toBeNull();
  });

  it('a static page targets its own route', () => {
    expect(layoutCanvas(pages, CANVAS_COLUMNS).frames[3].target).toBe('/about');
  });
});

describe('frames take the height of their captured page', () => {
  const heights = { '/::desktop': 3200, '/::tablet': 5000, '/::phone': 9100, '/about::phone': 700 };
  const { frames, rows, bounds } = layoutCanvas(pages, CANVAS_COLUMNS, heights);

  it('uses the captured height up to the cap and falls back to the device height', () => {
    expect(frames.filter((f) => f.route === '/').map((f) => f.height)).toEqual([2700, 3072, 2532]);
    expect(frames.find((f) => f.key === '/about::desktop')!.height).toBe(900);
    expect(frames.find((f) => f.key === '/about::phone')!.height).toBe(700);
  });

  it('sizes a row to its tallest frame and pushes the next row below it', () => {
    expect(rows[0].height).toBe(ROW_HEAD + 3072);
    expect(rows[1].y).toBe(rows[0].y + ROW_HEAD + 3072 + ROW_GAP);
    expect(rows[1].height).toBe(ROW_HEAD + 1024);
  });

  it('bounds follow the rows', () => {
    expect(bounds.height).toBe(rows[2].y + rows[2].height);
  });

  it('keeps x positions when heights arrive', () => {
    expect(frames.map((f) => f.x)).toEqual(layoutCanvas(pages, CANVAS_COLUMNS).frames.map((f) => f.x));
  });
});

describe('bounds', () => {
  it('wrap every frame and row head', () => {
    const { frames, rows, bounds } = layoutCanvas(pages, CANVAS_COLUMNS);

    expect(bounds).toEqual({ x: 0, y: 0, width: frames[2].x + frames[2].width, height: rows[2].y + rows[2].height });
  });

  it('are empty without pages', () => {
    expect(layoutCanvas([], CANVAS_COLUMNS).bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

const many = (count: number) => Array.from({ length: count }, (_, i) => ({ route: `/p${i}`, dynamic: false }));
const WIDE = { w: 1480, h: 900 };
const TALL = { w: 600, h: 1400 };

describe('layoutCanvas packs pages into a wrapping grid', () => {
  it('flows groups left to right and wraps after the chosen column count', () => {
    const { rows } = layoutCanvas(many(7), CANVAS_COLUMNS, {}, WIDE);
    const perRow = new Set(rows.map((r) => r.y)).size;
    const first = rows.filter((r) => r.y === rows[0].y);

    expect(first.length).toBeGreaterThan(1);
    expect(perRow).toBe(Math.ceil(7 / first.length));
    expect(first.map((r) => r.x)).toEqual(first.map((_, i) => i * (groupWidth(CANVAS_COLUMNS) + GROUP_GAP)));
  });

  it('keeps the route order, row by row', () => {
    const { rows } = layoutCanvas(many(9), CANVAS_COLUMNS, {}, WIDE);

    expect(rows.map((r) => r.route)).toEqual(many(9).map((p) => p.route));
    const ordered = [...rows].sort((a, b) => a.y - b.y || a.x - b.x).map((r) => r.route);
    expect(ordered).toEqual(rows.map((r) => r.route));
  });

  it('puts the frames of one page side by side under its route label, tops aligned', () => {
    const { rows, frames } = layoutCanvas(many(5), CANVAS_COLUMNS, {}, WIDE);
    const group = frames.filter((f) => f.route === '/p3');

    expect(new Set(group.map((f) => f.y)).size).toBe(1);
    expect(group[0].x).toBe(rows[3].x);
    expect(group[0].y).toBe(rows[3].y + ROW_HEAD);
    expect(group[1].x).toBe(group[0].x + group[0].width + COLUMN_GAP);
  });

  it('shows at most three device heights of a long page', () => {
    const { frames } = layoutCanvas(many(1), CANVAS_COLUMNS, { '/p0::desktop': 20000, '/p0::phone': 50000, '/p0::tablet': 2000 }, WIDE);
    const heights = Object.fromEntries(frames.map((f) => [f.size, f.height]));

    expect(heights[Size.Desktop]).toBe(HEIGHT_CAP_FACTOR * SIZES[Size.Desktop].height!);
    expect(heights[Size.Phone]).toBe(HEIGHT_CAP_FACTOR * SIZES[Size.Phone].height!);
    expect(heights[Size.Tablet]).toBe(2000);
  });

  it('keeps the real page height on the frame', () => {
    const { frames } = layoutCanvas(many(1), CANVAS_COLUMNS, { '/p0::desktop': 20000 }, WIDE);

    expect(frames[0].pageHeight).toBe(20000);
  });

  it('sizes a row to its tallest capped group', () => {
    const heights = { '/p0::desktop': 90000, '/p1::phone': 1500 };
    const { rows, frames } = layoutCanvas(many(2), CANVAS_COLUMNS, heights, { w: 6000, h: 1000 });
    const capped = HEIGHT_CAP_FACTOR * SIZES[Size.Desktop].height!;

    expect(rows[0].y).toBe(rows[1].y);
    expect(rows[0].height).toBe(ROW_HEAD + capped);
    expect(frames.filter((f) => f.route === '/p1').every((f) => f.y === rows[1].y + ROW_HEAD)).toBe(true);
  });

  it('leaves a gutter between rows', () => {
    const { rows } = layoutCanvas(many(3), CANVAS_COLUMNS, {}, TALL);

    expect(new Set(rows.map((r) => r.x)).size).toBe(1);
    expect(rows[1].y).toBe(rows[0].y + rows[0].height + ROW_GAP);
    expect(rows[2].y).toBe(rows[1].y + rows[1].height + ROW_GAP);
  });

  it('keeps a dynamic page without an example compact', () => {
    const { frames, rows } = layoutCanvas([{ route: '/blog/[slug]', dynamic: true }], CANVAS_COLUMNS, {}, WIDE);

    expect(frames.every((f) => f.height === COMPACT_HEIGHT)).toBe(true);
    expect(rows[0].height).toBe(ROW_HEAD + COMPACT_HEIGHT);
  });

  it('bounds wrap every group', () => {
    const { frames, bounds } = layoutCanvas(many(6), CANVAS_COLUMNS, { '/p2::desktop': 3000 }, WIDE);

    expect(bounds.width).toBe(Math.max(...frames.map((f) => f.x + f.width)));
    expect(bounds.height).toBe(Math.max(...frames.map((f) => f.y + f.height)));
  });
});

describe('columnsFor', () => {
  const heights = Array(12).fill(ROW_HEAD + 900);

  it('uses a single column without a viewport', () => {
    expect(columnsFor(heights, groupWidth(CANVAS_COLUMNS), null)).toBe(1);
  });

  it('spreads groups wider in a wide window than in a tall one', () => {
    expect(columnsFor(heights, groupWidth(CANVAS_COLUMNS), WIDE)).toBeGreaterThan(columnsFor(heights, groupWidth(CANVAS_COLUMNS), TALL));
  });

  it('never uses more columns than groups', () => {
    expect(columnsFor([ROW_HEAD + 900], groupWidth(CANVAS_COLUMNS), WIDE)).toBe(1);
  });

  it('picks the count with the largest fit zoom', () => {
    const scaleOf = (columns: number) => {
      const rows = Math.ceil(heights.length / columns);
      const width = columns * groupWidth(CANVAS_COLUMNS) + (columns - 1) * GROUP_GAP;
      const height = rows * (ROW_HEAD + 900) + (rows - 1) * ROW_GAP;

      return Math.min(WIDE.w / width, WIDE.h / height);
    };
    const best = columnsFor(heights, groupWidth(CANVAS_COLUMNS), WIDE);

    for (let c = 1; c <= heights.length; c++) {
      expect(scaleOf(best)).toBeGreaterThanOrEqual(scaleOf(c) - 1e-12);
    }
  });
});

describe('layoutCanvas with resized frames', () => {
  const pages = [{ route: '/a', dynamic: false }, { route: '/b', dynamic: false }];
  const key = (route: string, size: Size) => `${route}::${size}`;

  it('is unchanged without resized frames', () => {
    expect(layoutCanvas(pages, CANVAS_COLUMNS, {}, null, {})).toEqual(layoutCanvas(pages, CANVAS_COLUMNS));
  });

  it('gives a resized frame its own width and height', () => {
    const { frames } = layoutCanvas(pages, CANVAS_COLUMNS, {}, null, { [key('/a', Size.Phone)]: { width: 600, height: 700 } });

    expect(frames.find((f) => f.key === key('/a', Size.Phone))).toMatchObject({ width: 600, height: 700 });
  });

  it('pushes the next frame in the group to the right', () => {
    const wide = { [key('/a', Size.Desktop)]: { width: SIZES[Size.Desktop].width! + 300, height: 900 } };
    const [first, second] = layoutCanvas(pages, CANVAS_COLUMNS, {}, null, wide).frames;

    expect(second.x).toBe(first.x + first.width + COLUMN_GAP);
  });

  it('keeps groups from overlapping when one grows', () => {
    const wide = { [key('/a', Size.Phone)]: { width: 900, height: 900 } };
    const { frames } = layoutCanvas(pages, CANVAS_COLUMNS, {}, { w: 100000, h: 1000 }, wide);
    const lastOfA = frames.filter((f) => f.route === '/a').at(-1)!;
    const firstOfB = frames.find((f) => f.route === '/b')!;

    expect(firstOfB.x).toBeGreaterThanOrEqual(lastOfA.x + lastOfA.width + GROUP_GAP);
  });

  it('makes the row as tall as the resized frame', () => {
    const tall = { [key('/a', Size.Desktop)]: { width: 1440, height: 3000 } };
    const { frames } = layoutCanvas(pages, CANVAS_COLUMNS, {}, { w: 100, h: 10000 }, tall);

    expect(frames.find((f) => f.route === '/b')!.y).toBeGreaterThanOrEqual(ROW_HEAD + 3000 + ROW_GAP);
  });
});

describe('layoutFlow with resized frames', () => {
  it('lets a resized frame replace the measured size', () => {
    const { frames } = layoutFlow([{ key: 'a', name: 'A', size: { width: 300, height: 100 } }], ROW_WIDTH, { a: { width: 500, height: 250 } });

    expect(frames[0]).toMatchObject({ width: 500, height: 250 });
  });
});
