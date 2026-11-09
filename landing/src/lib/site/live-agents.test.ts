import { describe, expect, it } from 'vitest';
import { claimTweak, createLedger, curve, mayTweak, releaseTweak, rewriteFrom, thin, typeFrames } from './live-agents';

const always = (v: number) => () => v;

describe('live agents typing', () => {
  const text = 'The motion canvas for Claude Code';

  it('always ends on the real text', () => {
    for (const v of [0, 0.03, 0.5, 0.99]) {
      expect(typeFrames(text, 0, always(v)).at(-1)).toBe(text);
      expect(typeFrames(text, 11, always(v)).at(-1)).toBe(text);
    }
  });

  it('corrects the typos it makes', () => {
    const frames = typeFrames('canvas', 0, always(0.01));
    expect(frames.some((f) => !'canvas'.startsWith(f))).toBe(true);
    expect(frames.at(-1)).toBe('canvas');
  });

  it('backspaces to the kept prefix before retyping', () => {
    const frames = typeFrames(text, 22, always(0.9));
    expect(frames).toContain(text.slice(0, 22));
    expect(frames.every((f) => f.startsWith(text.slice(0, 22)))).toBe(true);
  });

  it('rewrites whole trailing words of long text only', () => {
    expect(rewriteFrom('Short headline', always(0.5))).toBe(0);
    const long = 'Paste any website. Claude rebuilds it as editable layers, animates it.';
    const at = rewriteFrom(long, always(0));
    expect(long[at - 1]).toBe(' ');
    expect(long.slice(at)).toBe('it.');
  });
});

describe('cursor path', () => {
  it('starts and lands on its endpoints', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 50 };
    expect(curve(a, b, 0, 40)).toEqual(a);
    const end = curve(a, b, 1, 40);
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(50);
  });
});

describe('thinning typed frames', () => {
  it('caps the frame count and keeps the final text', () => {
    const frames = Array.from({ length: 300 }, (_, i) => i);
    const kept = thin(frames, 40);
    expect(kept.length).toBeLessThanOrEqual(41);
    expect(kept.at(-1)).toBe(299);
  });
});

describe('tweak ledger', () => {
  const GAP = 3000;

  it('tweaks an element at most once, ever', () => {
    const ledger = createLedger<string>();
    expect(mayTweak(ledger, 'h1', 0, GAP)).toBe(true);
    claimTweak(ledger, 'h1', 0);
    releaseTweak(ledger, 'h1');
    expect(mayTweak(ledger, 'h1', 1e9, GAP)).toBe(false);
  });

  it('never runs two tweaks on one element, nor two within the gap', () => {
    const ledger = createLedger<string>();
    claimTweak(ledger, 'a', 0);
    expect(mayTweak(ledger, 'a', GAP, GAP)).toBe(false);
    expect(mayTweak(ledger, 'b', GAP - 1, GAP)).toBe(false);
    expect(mayTweak(ledger, 'b', GAP, GAP)).toBe(true);
  });
});
