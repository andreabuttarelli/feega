export type Revealed = { height: number; hidden: number };

export enum RevealMode {
  Loading = 'loading',
  Moving = 'moving',
  Still = 'still'
}

export function revealPage(mode: RevealMode): Revealed {
  const CONSENT = /\b(cookies?|consent|gdpr|tracking technologies)\b/i;
  const CONSENT_ROOTS = '#onetrust-consent-sdk, #CybotCookiebotDialog, #usercentrics-root, .cc-window, #cookie-banner, [id*="cookie-consent" i], [class*="cookie-banner" i]';
  const MAX_BANNER_TEXT = 1_500;

  for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
    img.loading = 'eager';
  }
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-src]')) {
    if (!img.getAttribute('src') || img.src.startsWith('data:')) {
      img.src = img.dataset.src!;
    }
  }
  for (const video of document.querySelectorAll('video')) {
    video.pause();
    if (!video.loop && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }
  }
  for (const animation of mode === 'loading' ? [] : document.getAnimations()) {
    try {
      if (animation.effect?.getComputedTiming().iterations === Infinity) {
        animation.pause();
        continue;
      }
      animation.finish();
    } catch {
      continue;
    }
  }

  if (mode === 'still') {
    const shown = new CSSStyleSheet();
    shown.replaceSync('*{content-visibility:visible!important}');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, shown];
    const last = window.setTimeout(() => undefined, 0);
    for (let id = 0; id <= last; id++) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    window.requestAnimationFrame = () => 0;
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const made = animate.call(this, keyframes, options);
      if (made.effect?.getComputedTiming().iterations !== Infinity) {
        made.finish();
      }
      return made;
    };
    const instant = new CSSStyleSheet();
    instant.replaceSync('*,*::before,*::after{transition:none!important}');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, instant];
  }

  let hidden = 0;
  const hide = (el: Element) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    hidden++;
  };
  document.querySelectorAll(CONSENT_ROOTS).forEach(hide);
  for (const el of document.querySelectorAll('body *')) {
    const css = getComputedStyle(el);
    if (css.position !== 'fixed' && css.position !== 'sticky' && !el.shadowRoot) {
      continue;
    }
    const text = `${(el as HTMLElement).innerText ?? ''} ${el.shadowRoot?.textContent ?? ''}`;
    if (text.length < MAX_BANNER_TEXT && CONSENT.test(text) && (el.querySelector('button, [role="button"], a') || el.shadowRoot?.querySelector('button, [role="button"], a'))) {
      hide(el);
    }
  }
  return { height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0), hidden };
}

export function everythingInView(): void {
  const MAX_TOLD = 2_000;
  const Native = window.IntersectionObserver;
  let told = 0;

  class SeesAll implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds = [0];
    readonly seen = new WeakSet<Element>();
    native: IntersectionObserver | null = null;
    constructor(readonly callback: IntersectionObserverCallback) {}

    observe(target: Element) {
      if (told >= MAX_TOLD) {
        this.native ??= Native ? new Native(this.callback) : null;
        this.native?.observe(target);
        return;
      }
      if (this.seen.has(target)) {
        return;
      }
      this.seen.add(target);
      told++;
      queueMicrotask(() => {
        const box = target.getBoundingClientRect();
        const entry = { target, isIntersecting: true, intersectionRatio: 1, boundingClientRect: box, intersectionRect: box, rootBounds: null, time: performance.now() } as IntersectionObserverEntry;
        this.callback([entry], this);
      });
    }

    unobserve(target: Element) {
      this.native?.unobserve(target);
    }

    disconnect() {
      this.native?.disconnect();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = SeesAll as unknown as typeof IntersectionObserver;
}
