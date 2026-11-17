import { describe, expect, it } from 'vitest';
import * as live from './live-agents';
import { mayHide, createRest, noteOccupancy, BuildMode, ELEMENT_RULES, PROTECTED_SELECTOR, isProtected, mayEnter, TEXT_SELECTOR, TweakLimit, claimTweak, createLedger, curve, mayTweak, releaseTweak, ruleFor } from './live-agents';

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

  it('never takes the brand chip with the logo mark', () => {
    expect(live.BUILD_TARGETS).not.toContain('.bar > a');
    expect(live.BUILD_TARGETS).toContain('.bar > a:not(.brand)');
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

describe('section caps', () => {
  const sections: Record<string, string[]> = {
    p1: ['#pricing'],
    p2: ['#pricing'],
    f1: ['#faq'],
    f2: ['#faq'],
    foot: ['.site-foot'],
    foot2: ['.site-foot'],
    mark: ['.site-foot', '.site-foot .mark'],
    hero: ['.hero'],
    buy: ['#pricing', PROTECTED_SELECTOR]
  };
  const within = (el: string, selector: string) => sections[el].includes(selector);

  it('lets pricing hold one cursor and refuses a second', () => {
    expect(mayEnter('p2', ['p1'], within)).toBe(false);
    expect(mayEnter('p1', [], within)).toBe(true);
  });

  it('holds the faq and the footer to one cursor each', () => {
    expect(mayEnter('f2', ['f1'], within)).toBe(false);
    expect(mayEnter('foot2', ['foot'], within)).toBe(false);
    expect(mayEnter('f1', [], within)).toBe(true);
  });

  it('keeps the wordmark crew out of the footer count and never capped', () => {
    expect(mayEnter('foot', ['mark', 'mark', 'mark', 'mark'], within)).toBe(true);
    expect(mayEnter('mark', ['foot', 'mark', 'mark', 'mark'], within)).toBe(true);
  });

  it('leaves every other section uncapped', () => {
    expect(mayEnter('hero', ['hero', 'hero', 'hero', 'hero', 'hero'], within)).toBe(true);
  });

  it('never rests on a price, a button or a question inside a capped section', () => {
    expect(isProtected('buy', within)).toBe(true);
    expect(isProtected('hero', within)).toBe(false);
  });
});

describe('section rest', () => {
  const within = (el: string, selector: string) => el === 'p1' && selector === '#pricing';
  const REST = live.SECTION_CAPS.find((s) => s.selector === '#pricing')!.restMs;

  it('refuses a new cursor in pricing right after the last one left', () => {
    const rest = createRest();
    noteOccupancy(rest, ['p1'], within, 1000);
    expect(mayEnter('p1', [], within, { rest, now: 1000 + REST - 1 })).toBe(false);
  });

  it('lets a cursor in once pricing has rested', () => {
    const rest = createRest();
    noteOccupancy(rest, ['p1'], within, 1000);
    expect(mayEnter('p1', [], within, { rest, now: 1000 + REST })).toBe(true);
  });

  it('never blocks the cursor that already holds the section', () => {
    const rest = createRest();
    noteOccupancy(rest, ['p1'], within, 1000);
    expect(mayEnter('p1', ['p1'], within, { rest, now: 1001 })).toBe(false);
    expect(mayEnter('p1', [], within, { rest, now: 1e9 })).toBe(true);
  });

  it('keeps counting a cursor that is still flying out of a section', () => {
    expect(live.holders([{ el: null, leaving: 'p1' }, { el: 'p1', leaving: null }, { el: null, leaving: null }])).toEqual(['p1', 'p1']);
  });
});

describe('content never waits for a cursor', () => {
  const within = (el: string, selector: string) => ({ price: ['#pricing'], question: ['#faq'], legal: ['.site-foot'], hero: ['.hero'] } as Record<string, string[]>)[el].includes(selector);

  it('keeps pricing, faq and footer elements visible without a cursor visit', () => {
    expect(['price', 'question', 'legal'].map((el) => mayHide(el, within))).toEqual([false, false, false]);
  });

  it('still lets other sections be built in by a cursor', () => {
    expect(mayHide('hero', within)).toBe(true);
  });
});
