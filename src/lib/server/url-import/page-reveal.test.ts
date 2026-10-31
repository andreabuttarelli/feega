// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { RevealMode, everythingInView, revealPage } from './page-reveal';

describe('the stand-in IntersectionObserver tells each target once', () => {
  it('stripe.com: a callback that observes its target again does not spin the page forever', async () => {
    everythingInView();
    const seen = vi.fn();
    const target = document.createElement('div');
    const observer = new IntersectionObserver((entries, self) => {
      seen(entries.length);
      self.observe(target);
    });

    observer.observe(target);
    await new Promise((done) => setTimeout(done, 20));

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('stripe.com: an endless feed that adds and observes a new sentinel each time stops growing', async () => {
    everythingInView();
    const seen = vi.fn();
    const observer = new IntersectionObserver((_entries, self) => {
      seen();
      self.observe(document.createElement('div'));
    });

    observer.observe(document.createElement('div'));
    await new Promise((done) => setTimeout(done, 50));

    expect(seen.mock.calls.length).toBeLessThan(5_000);
  });
});

describe('hidden content is forced visible only for the final read', () => {
  it('stripe.com: forcing it while the page still scrolls crashed the browser tab', () => {
    const sheets: string[] = [];
    Object.assign(globalThis, { CSSStyleSheet: class { replaceSync(css: string) { sheets.push(css); } } });
    Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true });
    Object.assign(document, { getAnimations: () => [] });

    revealPage(RevealMode.Moving);
    const moving = sheets.filter((css) => css.includes('content-visibility')).length;
    revealPage(RevealMode.Still);

    expect(moving).toBe(0);
    expect(sheets.some((css) => css.includes('content-visibility'))).toBe(true);
  });
});

describe('the first look at a page leaves its animations running', () => {
  it('stripe.com: finishing animations before the page scrolled crashed the browser tab', () => {
    const finish = vi.fn();
    Object.assign(globalThis, { CSSStyleSheet: class { replaceSync() {} } });
    Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true });
    Object.assign(document, { getAnimations: () => [{ effect: { getComputedTiming: () => ({ iterations: 1 }) }, finish, pause: vi.fn() }] });

    revealPage(RevealMode.Loading);

    expect(finish).not.toHaveBeenCalled();
  });
});
