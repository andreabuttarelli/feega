export type ActionKind = 'font' | 'colour' | 'resize' | 'nudge' | 'select' | 'tracking';
export type TargetKind = 'text' | 'media' | 'block';
export type Rng = () => number;
export type Point = { x: number; y: number };

export const PEER_COLOURS = ['#e5484d', '#0090ff', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f', '#12a594', '#ffc53d'];

export const ACTIONS_BY_TARGET: Record<TargetKind, ActionKind[]> = {
  text: ['font', 'colour', 'select', 'nudge'],
  media: ['resize', 'select', 'nudge'],
  block: ['select', 'nudge']
};

const WRITING: ActionKind[] = ['select', 'colour', 'font'];
const DESIGN: ActionKind[] = ['font', 'colour', 'resize', 'nudge'];
const LAYOUT: ActionKind[] = ['nudge', 'resize', 'select'];
const ALL: ActionKind[] = ['tracking', 'font', 'colour', 'resize', 'nudge', 'select'];

export const AGENTS: { name: string; skills: ActionKind[] }[] = [
  { name: 'Copywriter', skills: WRITING },
  { name: 'Art director', skills: DESIGN },
  { name: 'Claude', skills: ALL },
  { name: 'Brand agent', skills: ['colour', 'font', 'tracking'] },
  { name: 'Motion agent', skills: ['resize', 'nudge'] },
  { name: 'Codex', skills: ALL },
  { name: 'SEO agent', skills: WRITING },
  { name: 'Layout agent', skills: LAYOUT },
  { name: 'Type agent', skills: ['font', 'tracking'] },
  { name: 'Colour agent', skills: ['colour'] },
  { name: 'Image agent', skills: ['resize', 'select'] },
  { name: 'QA agent', skills: ['select', 'select', 'nudge'] },
  { name: 'Localization', skills: WRITING },
  { name: 'A11y agent', skills: ['colour', 'select'] },
  { name: 'Growth agent', skills: WRITING },
  { name: 'Cursor', skills: ALL },
  { name: 'Video agent', skills: ['resize', 'nudge'] },
  { name: 'Editor', skills: WRITING },
  { name: 'Gemini', skills: ALL },
  { name: 'Research agent', skills: WRITING },
  { name: 'Docs agent', skills: WRITING },
  { name: 'Social agent', skills: DESIGN },
  { name: 'Product agent', skills: LAYOUT },
  { name: 'Pricing agent', skills: WRITING }
];

export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function curve(a: Point, b: Point, t: number, bend: number): Point {
  const e = ease(t);
  const arc = Math.sin(Math.PI * e) * bend;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: a.x + dx * e - (dy / len) * arc, y: a.y + dy * e + (dx / len) * arc };
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function lockHeight(el: HTMLElement) {
  el.style.height = `${el.offsetHeight}px`;
}

export const CHAPTER_SELECTOR = '.chapter';

const outsideChapters = (selector: string) => `${selector}:not(${CHAPTER_SELECTOR} *)`;

export const BUILD_TARGETS = [
  '.bar > a',
  '.bar .links > a',
  '.bar .actions > a',
  '.bar > button',
  outsideChapters('main [data-agent-id]'),
  outsideChapters('main :is(h2, h3, p, li, img, video, pre, button, summary, input, label, [role="tablist"])'),
  '.site-foot :is(h2, p, a)'
];

export const BUILD_SELECTOR = BUILD_TARGETS.join(', ');

export function outermost(els: HTMLElement[]): HTMLElement[] {
  const set = new Set(els);
  return els.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (set.has(p)) {
        return false;
      }
    }
    return true;
  });
}


export type TweakLedger<T> = { done: Set<T>; active: Set<T>; lastAt: number };

export function createLedger<T>(): TweakLedger<T> {
  return { done: new Set(), active: new Set(), lastAt: -Infinity };
}

export enum TweakLimit {
  Once = 'once',
  Unlimited = 'unlimited'
}

export enum BuildMode {
  Style = 'style',
  Place = 'place'
}

export const TEXT_SELECTOR = ['h1 span', 'h2', 'h3', 'h4', 'p', 'li', 'a', 'button', 'summary', 'label', 'pre', '[role="tablist"]'].join(', ');

export type ElementRule = { selector: string; crew: number; limit: TweakLimit; build: BuildMode; beats: ActionKind[] };

export const ELEMENT_RULES: ElementRule[] = [
  { selector: '.site-foot .mark', crew: 4, limit: TweakLimit.Unlimited, build: BuildMode.Style, beats: ['font', 'colour', 'tracking', 'resize', 'select'] },
  { selector: TEXT_SELECTOR, crew: 0, limit: TweakLimit.Once, build: BuildMode.Style, beats: ['select', 'select', 'colour', 'font', 'tracking'] },
  { selector: '*', crew: 0, limit: TweakLimit.Once, build: BuildMode.Place, beats: ['select', 'resize'] }
];

export function ruleFor(matches: (selector: string) => boolean): ElementRule {
  return ELEMENT_RULES.find((rule) => matches(rule.selector)) ?? ELEMENT_RULES[ELEMENT_RULES.length - 1];
}

export function mayTweak<T>(ledger: TweakLedger<T>, el: T, now: number, gap: number, limit = TweakLimit.Once): boolean {
  if (ledger.active.has(el)) {
    return false;
  }

  return limit === TweakLimit.Unlimited || (!ledger.done.has(el) && now - ledger.lastAt >= gap);
}

export function claimTweak<T>(ledger: TweakLedger<T>, el: T, now: number, limit = TweakLimit.Once) {
  ledger.done.add(el);
  ledger.active.add(el);
  if (limit === TweakLimit.Once) {
    ledger.lastAt = now;
  }
}

export function releaseTweak<T>(ledger: TweakLedger<T>, el: T) {
  ledger.active.delete(el);
}
