import { describe, expect, it } from 'vitest';
import { Control, ROWS, type NumberRow } from './controls';
import { HOLD_MS, NUDGE_MS, heldValue, liveNumber } from './scrub';

function harness() {
  const previews: string[] = [];
  const writes: string[] = [];
  const frames: (() => void)[] = [];
  const timers: { at: number; run: () => void }[] = [];
  let clock = 0;
  const live = liveNumber({
    preview: (v) => previews.push(v),
    commit: (v) => writes.push(v),
    frame: (run) => frames.push(run),
    later: (run, ms) => {
      const timer = { at: clock + ms, run };
      timers.push(timer);
      return () => timers.splice(timers.indexOf(timer), 1);
    }
  });
  const flushFrame = () => frames.splice(0).forEach((f) => f());
  const advance = (ms: number) => {
    clock += ms;
    timers.filter((t) => t.at <= clock).forEach((t) => (timers.splice(timers.indexOf(t), 1), t.run()));
  };
  return { live, previews, writes, flushFrame, advance };
}

const numberRows = ROWS.filter((r): r is NumberRow => r.control === Control.Number);

describe('scrub of a number field', () => {
  it.each(numberRows.map((r) => [r.name, r] as const))('%s: previews every frame, writes once on release', (_, row) => {
    const { live, previews, writes, flushFrame } = harness();
    const values = ['11', '12', '13'];
    for (const v of values) {
      live.move(v);
      flushFrame();
    }
    live.release('13');

    expect(previews).toEqual(values);
    expect(writes).toEqual(['13']);
    expect(Object.keys(row.preview('13')).length).toBeGreaterThan(0);
  });

  it('moves inside one frame preview only the last value', () => {
    const { live, previews, flushFrame } = harness();
    live.move('1');
    live.move('2');
    flushFrame();

    expect(previews).toEqual(['2']);
  });

  it('arrow nudges preview at once and write once after the pause', () => {
    const { live, previews, writes, advance } = harness();
    live.nudge('1');
    live.nudge('2');
    advance(NUDGE_MS - 1);
    expect(writes).toEqual([]);
    advance(1);

    expect(previews).toEqual(['1', '2']);
    expect(writes).toEqual(['2']);
  });
});

describe('the value shown after release', () => {
  it('keeps the released value while a stale read arrives', () => {
    expect(heldValue({ value: 13, since: 0 }, 10, 500)).toBe(13);
  });

  it('lets the read through once it matches or the hold expires', () => {
    expect(heldValue({ value: 13, since: 0 }, 13, 500)).toBe(null);
    expect(heldValue({ value: 13, since: 0 }, 10, HOLD_MS)).toBe(null);
  });
});
