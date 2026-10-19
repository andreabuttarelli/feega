import { describe, expect, it } from 'vitest';
import { Stand, fillOrder, placeholder, standIn, type Look } from './placeholders';

const LOOK: Look = { paper: '#ffffff', line: '#e5e5e5' };
const box = (x: number) => ({ x, y: 0, w: 200, h: 100 });

describe('placeholders', () => {
  it('a card stands in as its empty panel, a frame as its black stage, never as nothing', () => {
    const card = placeholder(Stand.Card, { width: 200, height: 100 }, LOOK);
    const frame = placeholder(Stand.Frame, { width: 200, height: 100 }, LOOK);
    expect(card.list.background).toEqual([1, 1, 1, 1]);
    expect(card.list.items).toHaveLength(1);
    expect(frame.list.background).toEqual([0, 0, 0, 1]);
    expect(frame.list.items).toEqual([]);
  });

  it('nodes of one kind and size share one group, so a thousand stand-ins cost one upload', () => {
    expect(placeholder(Stand.Card, { width: 200, height: 100 }, LOOK).group).toBe(placeholder(Stand.Card, { width: 200, height: 100 }, LOOK).group);
    expect(placeholder(Stand.Card, { width: 200, height: 100 }, LOOK).group).not.toBe(placeholder(Stand.Frame, { width: 200, height: 100 }, LOOK).group);
  });

  it('shows the best ready layer: whole, then poster, then placeholder', () => {
    const ph = { id: 'a', group: 'ph', box: box(0), size: { width: 200, height: 100 } };
    const poster = { ...ph, group: 'poster' };
    const whole = { ...ph, group: 'whole' };
    expect(standIn([whole, poster, ph])).toBe(whole);
    expect(standIn([null, poster, ph])).toBe(poster);
    expect(standIn([null, null, ph])).toBe(ph);
  });
});

describe('fill order', () => {
  it('loads what is on screen first, nearest the centre first, and nothing off screen while the view has holes', () => {
    const items = [{ id: 'far', box: box(5000) }, { id: 'edge', box: box(700) }, { id: 'centre', box: box(300) }];
    expect(fillOrder(items, { x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 }).map((i) => i.id)).toEqual(['centre', 'edge']);
  });
});
