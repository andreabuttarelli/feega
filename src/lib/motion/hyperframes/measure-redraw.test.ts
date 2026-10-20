// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { REDRAWN, REDRAW_QUIET_MS, MEASURE_REQUEST, measureScript } from './measure';

const told: unknown[] = [];

const settle = () => vi.advanceTimersByTimeAsync(REDRAW_QUIET_MS * 2);

beforeAll(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = `<div id="root"><div class="layer" data-clip="a"><div class="fx"><span class="li" style="transform: translate(0%, 105%)">Ana</span></div></div></div>`;
  vi.spyOn(window.parent, 'postMessage').mockImplementation((m: unknown) => void told.push(m));
  new Function(measureScript().replace(/^<script>|<\/script>$/g, ''))();
  await settle();
});

beforeEach(async () => {
  await settle();
  told.length = 0;
});

const line = () => document.querySelector<HTMLElement>('.li')!;

describe('the preview tells the editor when its drawing moves', () => {
  it('once the drawing settles after changing on its own', async () => {
    line().style.transform = 'translate(0%, 50%)';
    await vi.advanceTimersByTimeAsync(REDRAW_QUIET_MS / 2);
    line().style.transform = 'translate(0px, 0px)';
    await vi.advanceTimersByTimeAsync(REDRAW_QUIET_MS / 2);
    expect(told).toEqual([]);

    await vi.advanceTimersByTimeAsync(REDRAW_QUIET_MS);
    expect(told).toEqual([{ type: REDRAWN }]);
  });

  it('its own measuring is not a change of the drawing', async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: MEASURE_REQUEST, id: 'q' },
        source: { postMessage: () => {} } as unknown as Window
      })
    );
    await settle();

    expect(told).toEqual([]);
  });

  it('a measurement says which stage it was taken on, so a stale one is told from a current one', async () => {
    const replies: { stage?: unknown }[] = [];
    const root = document.getElementById('root')!;
    Object.defineProperty(root, 'offsetWidth', { configurable: true, value: 764 });
    Object.defineProperty(root, 'offsetHeight', { configurable: true, value: 162 });
    window.dispatchEvent(new MessageEvent('message', { data: { type: MEASURE_REQUEST, id: 's' }, source: { postMessage: (m: { stage?: unknown }) => void replies.push(m) } as unknown as Window }));

    expect(replies[0].stage).toEqual({ width: 764, height: 162 });
  });
});
