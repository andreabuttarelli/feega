import { describe, expect, it, vi } from 'vitest';
import search from './fixtures/pinterest-search.json';
import board from './fixtures/pinterest-board.json';
import pin from './fixtures/pinterest-pin.json';
import { PINTEREST_MAX_PINS, pinterestBoard, pinterestPin, pinterestSearch, type PinterestGet } from './pinterest';

const answering = (...pages: unknown[]): PinterestGet => {
  const get = vi.fn();
  for (const page of pages) {
    get.mockResolvedValueOnce(page);
  }
  return get;
};

describe('pinterest', () => {
  it('search returns pins with their largest picture, the colour Pinterest gives them, pinner and board', async () => {
    const found = await pinterestSearch(answering(search), 'liquid glass ui', 3);

    expect(found).toMatchObject({ ok: true, requests: 1 });
    if (!found.ok) {
      return;
    }
    expect(found.pins).toHaveLength(3);
    expect(found.pins[0]).toEqual({
      id: '140806235018418',
      url: 'https://www.pinterest.com/pin/140806235018418/',
      title: null,
      description: 'an upload button with the word source btn in white on a gray background',
      image: { url: 'https://i.pinimg.com/originals/7d/05/58/7d0558f260a76d1f6a942549b0e37f3d.jpg', width: 2048, height: 1662 },
      colour: '#6B767E',
      link: null,
      pinner: 'joachimpers2275',
      board: { name: 'HA Design & Code', url: 'https://www.pinterest.com/joachimpers2275/ha-design-code/' }
    });
    expect(found.pins[1]).toMatchObject({ title: expect.stringContaining('Liquid glass AI UI design'), link: expect.stringContaining('behance.net') });
  });

  it('search asks for the query, and reads one more page only when the first is short', async () => {
    const get = answering(search, search);

    const found = await pinterestSearch(get, 'liquid glass', 5);

    expect(get).toHaveBeenNthCalledWith(1, '/v1/pinterest/search?query=liquid+glass');
    expect(get).toHaveBeenNthCalledWith(2, `/v1/pinterest/search?query=liquid+glass&cursor=${encodeURIComponent(search.cursor)}`);
    expect(found).toMatchObject({ ok: true, requests: 2 });
    expect(found.ok && found.pins).toHaveLength(5);
  });

  it('never returns more than the cap', async () => {
    const found = await pinterestSearch(answering(search, search, search), 'q', 1000);

    expect(found.ok && found.pins.length).toBeLessThanOrEqual(PINTEREST_MAX_PINS);
  });

  it('a pin url returns that pin', async () => {
    const get = answering(pin);

    const found = await pinterestPin(get, 'https://www.pinterest.com/pin/140806235018418/');

    expect(get).toHaveBeenCalledWith('/v1/pinterest/pin?url=https%3A%2F%2Fwww.pinterest.com%2Fpin%2F140806235018418%2F');
    expect(found).toMatchObject({
      ok: true,
      requests: 1,
      pins: [
        {
          id: '140806235018418',
          image: { url: 'https://i.pinimg.com/originals/7d/05/58/7d0558f260a76d1f6a942549b0e37f3d.jpg', width: 2048, height: 1662 },
          pinner: 'joachimpers2275',
          board: { name: 'HA Design & Code', url: 'https://www.pinterest.com/joachimpers2275/ha-design-code/' }
        }
      ]
    });
  });

  it('a board url returns its pins with their dominant colour', async () => {
    const found = await pinterestBoard(answering(board), 'https://www.pinterest.com/joachimpers2275/ha-design-code/', 10);

    expect(found).toMatchObject({ ok: true, requests: 1 });
    expect(found.ok && found.pins.map((p) => [p.title, p.colour])).toEqual([
      ['Neumorphism', '#d9d9d9'],
      [null, '#6b767e']
    ]);
  });

  it('refuses a url that is not on Pinterest without spending a request', async () => {
    const get = answering();

    expect(await pinterestPin(get, 'https://evil.example/pin/1')).toMatchObject({ ok: false, requests: 0 });
    expect(await pinterestBoard(get, 'http://169.254.169.254/latest', 5)).toMatchObject({ ok: false, requests: 0 });
    expect(get).not.toHaveBeenCalled();
  });

  it('a failed request says why and counts as spent', async () => {
    const get = vi.fn(async () => {
      throw new Error('scrapecreators 500: down');
    });

    expect(await pinterestSearch(get, 'q', 5)).toEqual({ ok: false, error: 'pinterest search failed: scrapecreators 500: down', requests: 1 });
  });
});
