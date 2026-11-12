import { describe, expect, it } from 'vitest';
import { FLIGHT_MAX_PENDING, Send, changed, closeMark, createFlightLog, finite, flightWanted, openMark, type FlightLine } from './flight-log';

const shelf = () => {
  const kept = new Map<string, string>();
  return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
};

const recorder = () => {
  let now = 0;
  const sent: { lines: FlightLine[]; how: Send }[] = [];
  const log = createFlightLog({ clock: () => now, send: (lines, how) => sent.push({ lines, how }) });
  return { log, sent, tick: (ms: number) => (now += ms) };
};

describe('the debug flag', () => {
  it('is off unless the url asks for it', () => {
    expect(flightWanted('', shelf())).toBe(false);
    expect(flightWanted('?coreDebug', shelf())).toBe(false);
  });

  it('turns on with ?debug or ?debug=1 and stays on for the tab across a reload', () => {
    const tab = shelf();

    expect(flightWanted('?debug', tab)).toBe(true);
    expect(flightWanted('', tab)).toBe(true);
    expect(flightWanted('?debug=1', shelf())).toBe(true);
  });

  it('turns off with ?debug=0', () => {
    const tab = shelf();
    flightWanted('?debug', tab);

    expect(flightWanted('?debug=0', tab)).toBe(false);
    expect(flightWanted('', tab)).toBe(false);
  });
});

describe('the crash marker', () => {
  it('reports nothing on the first session of a tab', () => {
    expect(openMark(shelf(), 'one')).toBeNull();
  });

  it('reports a session that never reached pagehide as not clean, with its last line', () => {
    const tab = shelf();
    openMark(tab, 'one');
    closeMark(tab, 'one', 41, false);

    expect(openMark(tab, 'two')).toEqual({ session: 'one', seq: 41, clean: false });
  });

  it('reports a session that ended on pagehide as clean', () => {
    const tab = shelf();
    openMark(tab, 'one');
    closeMark(tab, 'one', 7, true);

    expect(openMark(tab, 'two')).toEqual({ session: 'one', seq: 7, clean: true });
  });
});

describe('the flight log', () => {
  it('numbers lines from zero with the time they happened', () => {
    const { log, sent, tick } = recorder();
    log.note('start', { a: 1 });
    tick(250);
    log.note('sample');
    log.flush(Send.Fetch);

    expect(sent[0].lines).toEqual([
      { s: 0, t: 0, k: 'start', p: { a: 1 } },
      { s: 1, t: 250, k: 'sample' }
    ]);
  });

  it('sends nothing when nothing happened and never resends a line', () => {
    const { log, sent } = recorder();
    log.flush(Send.Fetch);
    log.note('sample');
    log.flush(Send.Fetch);
    log.flush(Send.Fetch);

    expect(sent).toHaveLength(1);
  });

  it('drops the oldest lines past its bound, leaving a gap in the numbers', () => {
    const { log, sent } = recorder();
    for (let i = 0; i < FLIGHT_MAX_PENDING + 5; i++) {
      log.note('sample');
    }
    log.flush(Send.Beacon);

    const seqs = sent.flatMap((b) => b.lines.map((l) => l.s));
    expect(seqs).toHaveLength(FLIGHT_MAX_PENDING);
    expect(seqs[0]).toBe(5);
    expect(sent.every((b) => b.how === Send.Beacon)).toBe(true);
  });

  it('knows the last number it gave out', () => {
    const { log } = recorder();
    log.note('a');
    log.note('b');

    expect(log.last()).toBe(1);
  });
});

describe('a sample', () => {
  it('flags a broken camera instead of losing it to JSON null', () => {
    expect(finite(NaN)).toBe('NaN');
    expect(finite(-Infinity)).toBe('-Infinity');
    expect(finite(1.23456)).toBe(1.235);
  });

  it('counts as changed only when a value moved', () => {
    expect(changed({ zoom: 1, x: 2 }, { zoom: 1, x: 2 })).toBe(false);
    expect(changed({ zoom: 1, x: 2 }, { zoom: 1, x: 3 })).toBe(true);
    expect(changed(null, { zoom: 1 })).toBe(true);
  });
});
