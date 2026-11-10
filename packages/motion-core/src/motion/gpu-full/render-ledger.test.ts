import { describe, expect, it } from 'vitest';
import { AttachGate, FrameLedger } from './render-ledger';
import type { Stats } from './render-wire';

const settled: Stats = { outcome: 'full', pending: false, cacheBytes: 0, pictureBytes: 0, scratchBytes: 0, wasmBytes: 0, lost: false, busy: false };

describe('FrameLedger', () => {
  it('stays pending while a frame is in flight even if the last answer was settled', () => {
    const ledger = new FrameLedger();
    ledger.answered(0, settled);
    ledger.sent();

    expect(ledger.pending()).toBe(true);

    ledger.answered(1, settled);

    expect(ledger.pending()).toBe(false);
  });

  it('stays pending after a partial frame, until a frame finishes', () => {
    const ledger = new FrameLedger();
    ledger.sent();
    ledger.answered(1, { ...settled, outcome: 'partial' });

    expect(ledger.pending()).toBe(true);

    ledger.sent();
    ledger.answered(1, { ...settled, outcome: 'full' });

    expect(ledger.pending()).toBe(false);
  });

  it('clears busy once the worker re-reports a drained GPU', () => {
    const ledger = new FrameLedger();
    ledger.sent();
    ledger.answered(1, { ...settled, busy: true });

    expect(ledger.busy()).toBe(true);

    ledger.answered(0, settled);

    expect(ledger.busy()).toBe(false);
  });

  it('is busy with two frames unanswered', () => {
    const ledger = new FrameLedger();
    ledger.sent();
    ledger.sent();

    expect(ledger.busy()).toBe(true);
  });

  it('keeps the last frame outcome when a batch without a frame answers', () => {
    const ledger = new FrameLedger();
    ledger.sent();
    ledger.answered(1, { ...settled, outcome: 'partial' });
    ledger.answered(0, { ...settled, outcome: '' });

    expect(ledger.stats().outcome).toBe('partial');
  });
});

describe('AttachGate', () => {
  it('holds work until attached, then runs it in order', () => {
    const gate = new AttachGate<number>();
    const ran: number[] = [];
    gate.offer(1, (n) => ran.push(n));
    gate.offer(2, (n) => ran.push(n));

    expect(ran).toEqual([]);

    gate.open((n) => ran.push(n));

    expect(ran).toEqual([1, 2]);
  });

  it('runs work at once while open, and holds it again after closing', () => {
    const gate = new AttachGate<number>();
    const ran: number[] = [];
    gate.open((n) => ran.push(n));
    gate.offer(1, (n) => ran.push(n));
    gate.close();
    gate.offer(2, (n) => ran.push(n));

    expect(ran).toEqual([1]);
  });
});
