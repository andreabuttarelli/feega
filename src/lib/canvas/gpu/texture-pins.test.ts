import { describe, expect, it } from 'vitest';
import { createLru } from './lru';
import { createPins } from './texture-pins';

type Card = { id: string; visible: boolean };

describe('texture pins — only cards in view keep their texture under budget', () => {
  it('an off-screen card loses its texture to a newer one, an in-view card keeps it', () => {
    const pins = createPins<Card>();
    const inView: Card = { id: 'in', visible: true };
    const away: Card = { id: 'away', visible: false };
    const next: Card = { id: 'next', visible: true };
    const evicted: string[] = [];
    const lru = createLru<string>(130, (url) => evicted.push(url), (url) => pins.pinned(url, (c) => c.visible));

    pins.use('a', inView);
    lru.set('a', 'A', 60);
    pins.use('b', away);
    lru.set('b', 'B', 60);
    pins.use('c', next);
    lru.set('c', 'C', 60);

    expect(evicted).toEqual(['b']);
    expect(pins.owners('b')).toEqual([away]);
  });

  it('a dropped card no longer pins anything', () => {
    const pins = createPins<Card>();
    const card: Card = { id: 'x', visible: true };
    pins.use('a', card);
    pins.use('b', card);
    pins.drop(card);
    expect(pins.pinned('a', () => true)).toBe(false);
    expect(pins.owners('b')).toEqual([]);
  });

  it('a texture shared by an off-screen and an in-view card stays pinned', () => {
    const pins = createPins<Card>();
    pins.use('a', { id: '1', visible: false });
    pins.use('a', { id: '2', visible: true });
    expect(pins.pinned('a', (c) => c.visible)).toBe(true);
  });
});
