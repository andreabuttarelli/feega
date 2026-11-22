import { describe, expect, it } from 'vitest';
import { ServerState } from '../messages';
import { browseHistory } from './history';
import { serverLook } from './server-look';

describe('browseHistory', () => {
  it('back and forward walk the visited routes', () => {
    const h = browseHistory();
    h.visited('/');
    h.visited('/pricing');
    h.visited('/docs');

    expect(h.back()).toBe('/pricing');
    expect(h.back()).toBe('/');
    expect(h.canBack()).toBe(false);
    expect(h.forward()).toBe('/pricing');
  });

  it('the page reporting the route we went back to does not add an entry', () => {
    const h = browseHistory();
    h.visited('/');
    h.visited('/pricing');
    h.visited(h.back()!);

    expect(h.canForward()).toBe(true);
  });

  it('a new route after going back drops the forward entries', () => {
    const h = browseHistory();
    h.visited('/');
    h.visited('/pricing');
    h.back();
    h.visited('/docs');

    expect(h.canForward()).toBe(false);
  });
});

describe('serverLook', () => {
  it('every state has a colour and a label', () => {
    expect(Object.values(ServerState).map((s) => serverLook(s).dot)).toEqual(['grey', 'amber', 'amber', 'green', 'amber', 'amber', 'red']);
  });
});
