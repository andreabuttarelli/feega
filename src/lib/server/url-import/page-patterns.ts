import type { RestNode } from '$lib/server/figma/rest-message';

export enum PatternKind {
  Accordion = 'accordion',
  Disclosure = 'disclosure',
  Tabs = 'tabs',
  Toggle = 'toggle',
  Carousel = 'carousel'
}

export type PatternLimits = { patterns: number; states: number; label: number; slides: number; settleMs: number; pageShare: number; kinds: Record<PatternKind, PatternKind> };

export const PATTERN_LIMITS: PatternLimits = {
  patterns: 32,
  states: 8,
  label: 24,
  slides: 6,
  settleMs: 450,
  pageShare: 0.5,
  kinds: { [PatternKind.Accordion]: PatternKind.Accordion, [PatternKind.Disclosure]: PatternKind.Disclosure, [PatternKind.Tabs]: PatternKind.Tabs, [PatternKind.Toggle]: PatternKind.Toggle, [PatternKind.Carousel]: PatternKind.Carousel }
};

export type PageVariant = { state: string; root: RestNode };

export type PagePattern = { ix: number; kind: PatternKind; prop: string; initial: string; states: string[]; variants: PageVariant[] };

export type FoundPattern = {
  kind: PatternKind;
  prop: string;
  root: Element;
  states: string[];
  initial: string;
  settleMs: number;
  enter: (state: string) => void;
  shows: (state: string) => boolean;
  triggers: (state: string) => [Element, string][];
};

export type PatternKit = { found: () => FoundPattern[] };

export function pagePatterns(limits: PatternLimits): PatternKit {
  const OPEN = 'Open';
  const CLOSED = 'Closed';
  const ON = 'On';
  const OFF = 'Off';
  const STATE = 'State';
  const TAB = 'Tab';
  const SLIDE = 'Slide';
  const NOW = 0;
  const MIN_SIDE = 4;

  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    return r.width >= MIN_SIDE && r.height >= MIN_SIDE && css.visibility !== 'hidden' && css.display !== 'none';
  };

  const commonOf = (els: Element[]): Element | null => {
    let at: Element | null = els[0] ?? null;
    while (at && !els.every((el) => at!.contains(el))) {
      at = at.parentElement;
    }
    return at;
  };

  const labelOf = (el: Element, fallback: string) => ((el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim() || fallback).slice(0, limits.label);

  const unique = (labels: string[]) => labels.map((label, i) => (labels.indexOf(label) === i ? label : `${label} ${i + 1}`));

  const other = (state: string, a: string, b: string) => (state === a ? b : a);

  const clickTo = (el: HTMLElement, want: () => boolean) => {
    if (!want()) {
      el.click();
    }
  };

  const accordions = (): FoundPattern[] =>
    [...document.querySelectorAll('details')].flatMap((details) => {
      const summary = [...details.children].find((c) => c.tagName === 'SUMMARY');
      if (!summary || !shown(summary)) {
        return [];
      }
      return [
        {
          kind: limits.kinds.accordion,
          prop: STATE,
          root: details,
          states: [CLOSED, OPEN],
          initial: details.open ? OPEN : CLOSED,
          settleMs: NOW,
          enter: (state: string) => (details.open = state === OPEN),
          shows: (state: string) => details.open === (state === OPEN),
          triggers: (state: string) => [[summary, other(state, OPEN, CLOSED)]]
        }
      ];
    });

  const controlled = (el: Element): Element | null => {
    const ids = (el.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean);
    const href = el.getAttribute('href');
    const id = ids[0] ?? (href?.startsWith('#') && href.length > 1 ? href.slice(1) : '');
    return id ? document.getElementById(id) : null;
  };

  const disclosures = (): FoundPattern[] =>
    [...document.querySelectorAll('[aria-expanded]')].flatMap((button) => {
      const panel = controlled(button);
      const root = panel ? commonOf([button, panel]) : null;
      if (!panel || !root || button.getAttribute('role') === 'tab' || button.closest('summary') || !shown(button) || !(button instanceof HTMLElement)) {
        return [];
      }
      const expanded = () => button.getAttribute('aria-expanded') === 'true';
      return [
        {
          kind: limits.kinds.disclosure,
          prop: STATE,
          root,
          states: [CLOSED, OPEN],
          initial: expanded() ? OPEN : CLOSED,
          settleMs: limits.settleMs,
          enter: (state: string) => clickTo(button, () => expanded() === (state === OPEN)),
          shows: (state: string) => expanded() === (state === OPEN),
          triggers: (state: string) => [[button, other(state, OPEN, CLOSED)]]
        }
      ];
    });

  const tabs = (): FoundPattern[] =>
    [...document.querySelectorAll('[role=tablist]')].flatMap((list) => {
      const all = [...list.querySelectorAll('[role=tab]')].filter((t): t is HTMLElement => t instanceof HTMLElement && shown(t)).slice(0, limits.states);
      const panels = all.map(controlled);
      const root = commonOf([list, ...panels.filter((p): p is Element => Boolean(p))]);
      if (all.length < 2 || !root || panels.every((p) => !p)) {
        return [];
      }
      const names = unique(all.map((t, i) => labelOf(t, `${TAB} ${i + 1}`)));
      const selected = Math.max(0, all.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
      return [
        {
          kind: limits.kinds.tabs,
          prop: TAB,
          root,
          states: names,
          initial: names[selected],
          settleMs: limits.settleMs,
          enter: (state: string) => all[names.indexOf(state)]?.click(),
          shows: (state: string) => all[names.indexOf(state)]?.getAttribute('aria-selected') === 'true',
          triggers: () => all.map((t, i): [Element, string] => [t, names[i]])
        }
      ];
    });

  const toggles = (): FoundPattern[] =>
    [...document.querySelectorAll('[role=switch], input[type=checkbox]')].flatMap((input) => {
      const label = input.closest('label') ?? (input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null);
      const face = shown(input) ? input : label;
      if (!face || !shown(face) || !(input instanceof HTMLElement)) {
        return [];
      }
      const on = () => (input instanceof HTMLInputElement ? input.checked : input.getAttribute('aria-checked') === 'true');
      const root = label && label.contains(input) ? label : face;
      return [
        {
          kind: limits.kinds.toggle,
          prop: STATE,
          root,
          states: [OFF, ON],
          initial: on() ? ON : OFF,
          settleMs: limits.settleMs,
          enter: (state: string) => clickTo(input, () => on() === (state === ON)),
          shows: (state: string) => on() === (state === ON),
          triggers: (state: string) => [[face, other(state, ON, OFF)]]
        }
      ];
    });

  type Swiping = HTMLElement & { swiper?: { slides: unknown[]; activeIndex: number; slideTo: (i: number, speed?: number) => void; realIndex?: number } };

  const carousels = (): FoundPattern[] =>
    [...document.querySelectorAll('.swiper, .swiper-container')].flatMap((el) => {
      const swiper = (el as Swiping).swiper;
      const count = Math.min(swiper?.slides.length ?? 0, limits.slides);
      if (!swiper || count < 2 || !shown(el)) {
        return [];
      }
      const names = Array.from({ length: count }, (_, i) => `${SLIDE} ${i + 1}`);
      const next = el.querySelector('.swiper-button-next');
      const prev = el.querySelector('.swiper-button-prev');
      const bullets = [...el.querySelectorAll('.swiper-pagination-bullet')].slice(0, count);
      const at = (state: string) => names.indexOf(state);
      return [
        {
          kind: limits.kinds.carousel,
          prop: SLIDE,
          root: el,
          states: names,
          initial: names[Math.min(count - 1, swiper.activeIndex)] ?? names[0],
          settleMs: limits.settleMs,
          enter: (state: string) => swiper.slideTo(at(state), 0),
          shows: (state: string) => swiper.activeIndex === at(state),
          triggers: (state: string) => [
            ...bullets.map((b, i): [Element, string] => [b, names[i]]),
            ...(next ? [[next, names[(at(state) + 1) % count]] as [Element, string]] : []),
            ...(prev ? [[prev, names[(at(state) + count - 1) % count]] as [Element, string]] : [])
          ]
        }
      ];
    });

  const ROWS: (() => FoundPattern[])[] = [accordions, tabs, carousels, disclosures, toggles];

  const local = (root: Element) => {
    const r = root.getBoundingClientRect();
    const page = document.documentElement.scrollWidth * document.documentElement.scrollHeight;
    return root !== document.body && root !== document.documentElement && r.width * r.height <= page * limits.pageShare;
  };

  const found = () => {
    const taken: FoundPattern[] = [];
    for (const row of ROWS) {
      for (const p of row()) {
        const clashes = taken.some((t) => t.root === p.root || t.root.contains(p.root) || p.root.contains(t.root));
        if (!clashes && shown(p.root) && local(p.root) && taken.length < limits.patterns) {
          taken.push(p);
        }
      }
    }
    return taken;
  };

  return { found };
}
