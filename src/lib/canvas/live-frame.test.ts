import { describe, expect, it } from 'vitest';
import { Breakpoint, LIVE_WIDTH, liveFrameData, liveFrameOf, liveUrl, liveRoutes } from './live-frame';

describe('liveFrameOf', () => {
  it('legge rotta, larghezza e poster', () => {
    expect(liveFrameOf({ live: { route: '/pricing', width: 390, poster: 'a1' } })).toEqual({ route: '/pricing', width: 390, poster: 'a1' });
  });

  it('un nodo senza live non è un live frame', () => {
    expect(liveFrameOf({ url: 'https://x.com' })).toBeNull();
  });
});

describe('liveFrameData', () => {
  it('normalizza la rotta e parte senza poster', () => {
    expect(liveFrameData('pricing', Breakpoint.Mobile)).toEqual({ live: { route: '/pricing', width: LIVE_WIDTH[Breakpoint.Mobile], poster: null } });
  });
});

describe('liveUrl', () => {
  it('unisce origine del dev server e rotta', () => {
    expect(liveUrl('http://localhost:3000/', '/pricing')).toBe('http://localhost:3000/pricing');
  });
});

describe('liveRoutes', () => {
  it('raccoglie le rotte importate da codice, senza doppioni', () => {
    expect(liveRoutes([{ route: '/' }, { route: '/pricing' }, { route: '/' }, {}])).toEqual(['/', '/pricing']);
  });
});
