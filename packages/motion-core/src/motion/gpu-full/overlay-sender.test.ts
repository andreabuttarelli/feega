import { describe, expect, it } from 'vitest';
import type { Attached } from './core-web';
import { overlaySender } from './core-web';
import { OverlayPart } from './core-overlay';
import type { Item } from './display-list';

const item = (clip: string) => ({ kind: 'path', clip }) as unknown as Item;

function fakeCore(splices: boolean) {
  const calls: string[] = [];
  const core = {
    set_overlay: (items: string) => calls.push(`set ${items}`),
    set_selected_overlay: (items: string) => calls.push(`set-selected ${items}`),
    set_live_overlay: (items: string) => calls.push(`set-live ${items}`),
    splice_overlay: (head: number, tail: number, items: string) => calls.push(`splice ${head} ${tail} ${items}`) > 0 && splices
  } as unknown as Attached;
  return { core, calls };
}

describe('overlaySender', () => {
  const [a, b, c] = [item('a'), item('b'), item('c')];

  it('sends the whole overlay first, then only the changed items', () => {
    const { core, calls } = fakeCore(true);
    const send = overlaySender(core);

    send(OverlayPart.Fixed, [a, b]);
    send(OverlayPart.Fixed, [a, c]);

    expect(calls).toEqual([`set ${JSON.stringify([a, b])}`, `splice 1 0 ${JSON.stringify([c])}`]);
  });

  it('falls back to the whole overlay when the core refuses the splice', () => {
    const { core, calls } = fakeCore(false);
    const send = overlaySender(core);

    send(OverlayPart.Fixed, [a, b]);
    send(OverlayPart.Fixed, [a, c]);

    expect(calls.at(-1)).toBe(`set ${JSON.stringify([a, c])}`);
  });

  it('sends the whole overlay to a core that cannot splice', () => {
    const { core, calls } = fakeCore(true);
    const send = overlaySender(core);

    send(OverlayPart.Selected, [a, b]);
    send(OverlayPart.Selected, [a, c]);

    expect(calls).toEqual([`set-selected ${JSON.stringify([a, b])}`, `set-selected ${JSON.stringify([a, c])}`]);
  });
});
