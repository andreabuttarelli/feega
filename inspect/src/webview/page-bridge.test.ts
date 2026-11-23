import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACKED } from '../messages';
import { pageBridge } from './page-bridge';

const ORIGIN = 'http://localhost:5173';

function pageWindow() {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('location', { origin: ORIGIN });
  return (data: unknown) => target.dispatchEvent(Object.assign(new Event('message'), { data, origin: ORIGIN }));
}

afterEach(() => vi.unstubAllGlobals());

describe('tracked rects reach the view', () => {
  it('a rect that disappears is reported, so the outline cannot stay behind', () => {
    const post = pageWindow();
    const tracked: unknown[] = [];
    pageBridge(() => null, { tracked: (slot: string, rect: unknown) => tracked.push([slot, rect]) } as never);

    post({ type: TRACKED, slot: 'selected', rect: { x: 0, y: 0, width: 10, height: 10 } });
    post({ type: TRACKED, slot: 'selected', rect: null });

    expect(tracked).toEqual([
      ['selected', { x: 0, y: 0, width: 10, height: 10 }],
      ['selected', null]
    ]);
  });
});
