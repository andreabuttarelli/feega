export type Revealed = { height: number; hidden: number };

export enum RevealMode {
  Moving = 'moving',
  Still = 'still'
}

type Sample = { seen: number; opacity: number; centre: number; values: Record<string, string>; last: string; y: number; restless: boolean };
type Swiper = { autoplay?: { stop: () => void }; slideToLoop?: (i: number, ms: number, events: boolean) => void; slideTo: (i: number, ms: number, events: boolean) => void; params?: { loop?: boolean } };
type Looping = { repeat: () => number; pause: (at: number) => void };
type CarouselWindow = Window & {
  Flickity?: { data: (e: Element) => { select: (i: number, wrap: boolean, instant: boolean) => void } | undefined };
  jQuery?: (e: Element) => { slick?: (cmd: string, i: number, instant: boolean) => void };
  gsap?: { globalTimeline: { getChildren: (nested: boolean, tweens: boolean, timelines: boolean) => Looping[] } };
};
type StillWindow = Window & {
  __feegaStill?: boolean;
  __feegaInView?: Map<Element, Sample>;
  __feegaConsent?: MutationObserver;
  __feegaShadows?: ShadowRoot[];
  __feegaWatch?: (root: Node) => void;
};

export function revealPage(mode: RevealMode): Revealed {
  const CONSENT = /\b(cookies?|consent|gdpr|tracking technologies)\b/i;
  const CONSENT_ROOTS = '#onetrust-consent-sdk, #CybotCookiebotDialog, #usercentrics-root, .cc-window, #cookie-banner, [id*="cookie-consent" i], [class*="cookie-banner" i]';
  const MAX_BANNER_TEXT = 1_500;
  const CAROUSELS: { selector: string; first: (el: Element) => void }[] = [
    {
      selector: '.swiper, .swiper-container',
      first: (el) => {
        const swiper = (el as Element & { swiper?: Swiper }).swiper;
        swiper?.autoplay?.stop();
        if (swiper?.params?.loop && swiper.slideToLoop) {
          swiper.slideToLoop(0, 0, false);
          return;
        }
        swiper?.slideTo(0, 0, false);
      }
    },
    { selector: '.splide', first: (el) => (el as Element & { splide?: { go: (i: number) => void } }).splide?.go(0) },
    { selector: '.flickity-enabled', first: (el) => (window as CarouselWindow).Flickity?.data(el)?.select(0, false, true) },
    { selector: '.slick-initialized', first: (el) => (window as CarouselWindow).jQuery?.(el).slick?.('slickGoTo', 0, true) }
  ];
  const carousels = [...CAROUSELS.map((c) => c.selector), '.w-slider'].join(', ');
  const state = window as StillWindow;

  for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
    img.loading = 'eager';
  }
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-src]')) {
    if (!img.getAttribute('src') || img.src.startsWith('data:')) {
      img.src = img.dataset.src!;
    }
  }
  const shown = new CSSStyleSheet();
  shown.replaceSync('*{content-visibility:visible!important}');
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, shown];
  for (const video of document.querySelectorAll('video')) {
    video.pause();
    if (!video.loop && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }
  }
  for (const { selector, first } of CAROUSELS) {
    for (const el of document.querySelectorAll(selector)) {
      try {
        first(el);
      } catch {
        continue;
      }
    }
  }
  const gsap = (window as CarouselWindow).gsap;
  for (const looping of gsap?.globalTimeline.getChildren(true, true, true).filter((t) => t.repeat() === -1) ?? []) {
    looping.pause(0);
  }
  for (const animation of document.getAnimations()) {
    try {
      if (animation.effect?.getComputedTiming().iterations === Infinity) {
        animation.pause();
        animation.currentTime = 0;
        continue;
      }
      animation.finish();
    } catch {
      continue;
    }
  }

  if (mode === 'still') {
    state.__feegaStill = true;
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
      if (made.effect?.getComputedTiming().iterations === Infinity) {
        made.pause();
        made.currentTime = 0;
        return made;
      }
      made.finish();
      return made;
    };
    const instant = new CSSStyleSheet();
    instant.replaceSync(`*,*::before,*::after{transition:none!important}${CONSENT_ROOTS}{display:none!important}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, instant];
    for (const [el, { values, restless }] of state.__feegaInView ?? []) {
      if (restless || !el.isConnected || el.closest(carousels)) {
        continue;
      }
      const now = getComputedStyle(el);
      for (const [prop, value] of Object.entries(values)) {
        if (prop !== 'visibility' || now.getPropertyValue(prop) !== value) {
          (el as HTMLElement).style.setProperty(prop, value, 'important');
        }
      }
    }
  }

  let hidden = 0;
  const hide = (el: Element) => {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    hidden++;
  };
  const consentBanner = (el: Element) => {
    const css = getComputedStyle(el);
    if (css.position !== 'fixed' && css.position !== 'sticky' && !el.shadowRoot) {
      return false;
    }
    const inShadow = [...(el.shadowRoot?.children ?? [])].filter((c) => !/^(STYLE|SCRIPT|LINK)$/.test(c.tagName)).map((c) => (c as HTMLElement).innerText ?? '');
    const text = `${(el as HTMLElement).innerText ?? ''} ${inShadow.join(' ')}`;
    return text.length < MAX_BANNER_TEXT && CONSENT.test(text) && Boolean(el.querySelector('button, [role="button"], a') || el.shadowRoot?.querySelector('button, [role="button"], a'));
  };
  document.querySelectorAll(CONSENT_ROOTS).forEach(hide);
  for (const el of document.querySelectorAll('body *, html > :not(head, body)')) {
    if (consentBanner(el)) {
      hide(el);
    }
  }
  if (mode === 'still' && !state.__feegaConsent) {
    const consent = new MutationObserver((records) => {
      const touched = new Set<Element>();
      for (const record of records) {
        for (const node of record.type === 'childList' ? record.addedNodes : [record.target]) {
          const root = node.getRootNode();
          if (root instanceof ShadowRoot) {
            touched.add(root.host);
          }
          if (node instanceof Element) {
            touched.add(node);
            node.querySelectorAll('*').forEach((inner) => touched.add(inner));
          }
        }
      }
      for (const el of touched) {
        if (el.isConnected && consentBanner(el)) {
          hide(el);
        }
      }
    });
    state.__feegaConsent = consent;
    state.__feegaWatch = (root) => consent.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    [document.documentElement, ...(state.__feegaShadows ?? [])].forEach(state.__feegaWatch);
  }

  return {
    height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    hidden
  };
}

export function inViewSampled(): number {
  const PROPS = ['opacity', 'transform', 'translate', 'scale', 'rotate', 'filter', 'clip-path', 'visibility', 'stroke-dashoffset'];
  const STYLED = PROPS.map((p) => `[style*="${p}"]`).join(', ');
  const GAIN = 0.01;
  const IN_VIEW = 0.5;
  const state = window as StillWindow;
  const seen = (state.__feegaInView ??= new Map());

  for (const animation of document.getAnimations()) {
    const timed = animation.timeline === document.timeline && animation.effect?.getComputedTiming().iterations !== Infinity;
    if (timed) {
      try {
        animation.finish();
      } catch {
        continue;
      }
    }
  }
  const moving = new Set<Element>(document.querySelectorAll(STYLED));
  for (const animation of document.getAnimations()) {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    if (target) {
      moving.add(target);
    }
  }
  const [vw, vh] = [window.innerWidth, window.innerHeight];
  for (const el of moving) {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const fraction = area ? (w * h) / Math.min(area, vw * vh) : 0;
    const centre = Math.abs((r.top + r.bottom) / 2 - vh / 2) / vh;
    const css = getComputedStyle(el);
    const values = Object.fromEntries(PROPS.map((p) => [p, css.getPropertyValue(p)]));
    const opacity = Number(values.opacity);
    const last = JSON.stringify(values);
    const held = seen.get(el);
    if (!held) {
      seen.set(el, { seen: fraction, opacity, centre, values, last, y: window.scrollY, restless: false });
      continue;
    }
    held.restless ||= held.y === window.scrollY && held.last !== last;
    held.last = last;
    held.y = window.scrollY;
    const shown = fraction >= IN_VIEW;
    const better = held.seen < IN_VIEW ? shown || fraction > held.seen + GAIN : shown && (opacity > held.opacity + GAIN || (Math.abs(opacity - held.opacity) <= GAIN && centre < held.centre - GAIN));
    if (better) {
      Object.assign(held, { seen: fraction, opacity, centre, values });
    }
  }
  return seen.size;
}

export function heldStill(): void {
  const ENVIRONMENT = /^(scroll|scrollend|resize|wheel|mousewheel|touchstart|touchmove|touchend|pointermove|pointerover|pointerenter|pointerleave|pointerout|mousemove|mouseover|mouseenter|mouseleave|mouseout|focus|blur|focusin|focusout|visibilitychange|orientationchange)$/;
  const state = window as StillWindow;
  const still = () => state.__feegaStill === true;

  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit) {
    const root = attach.call(this, { ...init, mode: 'open' });
    (state.__feegaShadows ??= []).push(root);
    state.__feegaWatch?.(root);
    return root;
  };

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => raf((t) => (still() ? undefined : callback(t)));

  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  const gated = new WeakMap<object, EventListener>();
  proto.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    if (!listener || !(ENVIRONMENT.test(type) || this instanceof MediaQueryList)) {
      return add.call(this, type, listener, options);
    }
    const held =
      gated.get(listener) ??
      function (this: unknown, event: Event) {
        if (still()) {
          return;
        }
        return typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event);
      };
    gated.set(listener, held);
    return add.call(this, type, held, options);
  };
  proto.removeEventListener = function (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    return remove.call(this, type, (listener && gated.get(listener)) ?? listener, options);
  };

  const Observer = window.ResizeObserver;
  if (Observer) {
    window.ResizeObserver = class extends Observer {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => (still() ? undefined : callback(entries, observer)));
      }
    };
  }
}

export function everythingInView(): void {
  class SeesAll implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds = [0];
    constructor(readonly callback: IntersectionObserverCallback) {}

    observe(target: Element) {
      queueMicrotask(() => {
        const box = target.getBoundingClientRect();
        const entry = {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: box,
          intersectionRect: box,
          rootBounds: null,
          time: performance.now()
        } as IntersectionObserverEntry;
        this.callback([entry], this);
      });
    }

    unobserve() {}

    disconnect() {}

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = SeesAll as unknown as typeof IntersectionObserver;
}
