import { describe, expect, it } from 'vitest';
import * as live from './live-agents';
import { BuildMode, ELEMENT_RULES, TEXT_SELECTOR, TweakLimit, claimTweak, createLedger, curve, mayTweak, releaseTweak, ruleFor } from './live-agents';

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

  it('lets a resident element be tweaked again and again, one beat at a time', () => {
    const ledger = createLedger<string>();
    claimTweak(ledger, 'mark', 0, TweakLimit.Unlimited);
    expect(mayTweak(ledger, 'mark', 1, GAP, TweakLimit.Unlimited)).toBe(false);
    releaseTweak(ledger, 'mark');
    expect(mayTweak(ledger, 'mark', 1, GAP, TweakLimit.Unlimited)).toBe(true);
    expect(mayTweak(ledger, 'mark', 1, GAP, TweakLimit.Once)).toBe(false);
  });
});

describe('element rules', () => {
  it('keeps a standing crew on the footer wordmark', () => {
    const rule = ruleFor((selector) => selector === '.site-foot .mark');
    expect(rule.limit).toBe(TweakLimit.Unlimited);
    expect(rule.crew).toBeGreaterThanOrEqual(3);
    expect(rule.crew).toBeLessThanOrEqual(5);
  });

  it('only styles text, so every word is visible from first paint', () => {
    const text = ruleFor((selector) => selector === TEXT_SELECTOR);
    expect(text.build).toBe(BuildMode.Style);
    for (const tag of ['h1 span', 'h2', 'h3', 'p', 'li', 'a', 'button', 'summary']) {
      expect(TEXT_SELECTOR.split(', ')).toContain(tag);
    }
  });

  it('never retypes text and never hides anything with CSS', () => {
    for (const rule of ELEMENT_RULES) {
      expect(rule.beats).not.toContain('type');
    }
    expect('BUILD_HEAD' in live).toBe(false);
  });

  it('leaves the chapters alone, so no cursor covers their copy or buttons', () => {
    const inMain = live.BUILD_TARGETS.filter((selector) => selector.startsWith('main'));
    expect(inMain.length).toBeGreaterThan(0);
    for (const selector of inMain) {
      expect(selector.endsWith(`:not(${live.CHAPTER_SELECTOR} *)`)).toBe(true);
    }
  });

  it('places only the remaining visuals', () => {
    expect(ELEMENT_RULES.at(-1)).toMatchObject({ selector: '*', build: BuildMode.Place });
  });
});

describe('size lock', () => {
  it('locks the layout height, not the scaled one, so the page never shrinks under the reader', () => {
    const el = { offsetHeight: 541, style: { height: '' }, getBoundingClientRect: () => ({ height: 483 }) };
    live.lockHeight(el as unknown as HTMLElement);
    expect(el.style.height).toBe('541px');
  });
});
