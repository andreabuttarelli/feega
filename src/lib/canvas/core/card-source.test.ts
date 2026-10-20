import { describe, expect, it } from 'vitest';
import { faceOf } from '$lib/canvas/gpu/card-face';
import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
import { CHROME_REACH, cardKey, cardOnCanvas, cardsOnCanvas, portMarks, ringColour, type CardTile } from './card-source';
import { PortState, type Glyphs } from './chrome';
import type { CoreTheme } from './overlay';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', line: '#e5e5e5', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size) => ({ contours: [[0, 0, text.length * size, 0, text.length * size, size, 0, size]], width: text.length * size, height: size });

const tile: CardTile = {
  id: 'n',
  box: { x: 100, y: 200, w: 240, h: 160 },
  face: faceOf({ id: 'n', kind: 'doc' }, { content: 'hi' }, (id) => id),
  shot: null,
  inputs: [],
  outputs: [{ type: 'text', state: PortState.Quiet }],
  label: 'Document',
  icon: null
};

const xs = (c: number[][]) => c.flatMap((k) => k.filter((_, i) => i % 2 === 0));
const ys = (c: number[][]) => c.flatMap((k) => k.filter((_, i) => i % 2 === 1));

describe('cardOnCanvas', () => {
  it('grows the box by the chrome reach so labels and ports are not scissored away', () => {
    const f = cardOnCanvas(tile, theme, glyphs);

    expect(f.box).toEqual({ x: 100 - CHROME_REACH.side, y: 200 - CHROME_REACH.top, w: 240 + 2 * CHROME_REACH.side, h: 160 + CHROME_REACH.top + CHROME_REACH.bottom });
    expect(f.list.width).toBe(f.box.w);
    expect(f.list.height).toBe(f.box.h);
  });

  it('draws the card and its chrome in the grown box, one unit per world pixel', () => {
    const f = cardOnCanvas(tile, theme, glyphs);
    const all = f.list.items.flatMap((i) => ('contours' in i ? i.contours : []));

    expect(Math.min(...xs(all))).toBeGreaterThanOrEqual(0);
    expect(Math.min(...ys(all))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs(all))).toBeLessThanOrEqual(f.box.w);
    expect(f.list.items.some((i) => i.clip === 'n:label')).toBe(true);
  });
});

describe('card group', () => {
  it('holds no hover, ring or handles: they are overlay, drawn every frame', () => {
    const f = cardOnCanvas(tile, theme, glyphs);
    const drawn = new Set(f.list.items.map((i) => i.clip.split(':')[1]));

    expect(drawn.has('ring') || drawn.has('hover') || drawn.has('handle') || drawn.has('port-name')).toBe(false);
  });
});

describe('selection ring colour', () => {
  it('rings in the output colour, the accent when there is none', () => {
    expect(ringColour(tile, theme)).toBe(CONNECTOR_STYLE.text.color);
    expect(ringColour({ ...tile, outputs: [] }, theme)).toBe(theme.accent);
  });
});

describe('portMarks', () => {
  const at = { id: 'n', x: 0, y: 0, w: 10, h: 10 };

  it('marks typed inputs and a single output quiet', () => {
    expect(portMarks({ ...at, connectors: ['text'], output: 'images' })).toEqual({ inputs: [{ type: 'text', state: PortState.Quiet }], outputs: [{ type: 'images', state: PortState.Quiet }] });
  });

  it('lists named outputs with their labels', () => {
    expect(portMarks({ ...at, outputs: [{ handle: 'a', port: 'videos' }] }).outputs).toEqual([{ type: 'videos', state: PortState.Quiet, label: 'a' }]);
  });

  it('has no ports when the tile is not connectable', () => {
    expect(portMarks({ ...at, connectable: false, connectors: ['text'], output: 'text' })).toEqual({ inputs: [], outputs: [] });
  });
});

describe('cardKey', () => {
  it('stays the same when only the position changes, so a moved card reuses its group', () => {
    expect(cardKey({ ...tile, box: { ...tile.box, x: 999 } })).toBe(cardKey(tile));
  });

  it('changes with anything that changes the drawing', () => {
    expect(cardKey({ ...tile, box: { ...tile.box, w: 300 } })).not.toBe(cardKey(tile));
    expect(cardKey({ ...tile, label: 'Other' })).not.toBe(cardKey(tile));
  });
});

describe('cards while another node is dragged', () => {
  it('a card whose look did not change keeps its list and only moves', () => {
    let shaped = 0;
    const counting: Glyphs = (text, size) => (shaped++, glyphs(text, size));
    const cards = cardsOnCanvas(theme, counting, counting);
    const first = cards(tile);
    const after = shaped;
    const moved = cards({ ...tile, box: { ...tile.box, x: 400 } });
    expect(shaped).toBe(after);
    expect(moved.list).toBe(first.list);
    expect(moved).toEqual(cardOnCanvas({ ...tile, box: { ...tile.box, x: 400 } }, theme, glyphs));
  });

  it('a card whose look changed is drawn again', () => {
    const cards = cardsOnCanvas(theme, glyphs);
    expect(cards({ ...tile, label: 'Other' }).list).not.toBe(cards(tile).list);
  });
});
