export type ActionKind = 'type' | 'font' | 'colour' | 'resize' | 'nudge' | 'select' | 'tracking';
export type TargetKind = 'text' | 'media' | 'block';
export type Rng = () => number;
export type Point = { x: number; y: number };

export const PEER_COLOURS = ['#e5484d', '#0090ff', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f', '#12a594', '#ffc53d'];

export const ACTIONS_BY_TARGET: Record<TargetKind, ActionKind[]> = {
  text: ['font', 'colour', 'select', 'nudge'],
  media: ['resize', 'select', 'nudge'],
  block: ['select', 'nudge']
};

const WRITING: ActionKind[] = ['type', 'type', 'select'];
const DESIGN: ActionKind[] = ['font', 'colour', 'resize', 'nudge'];
const LAYOUT: ActionKind[] = ['nudge', 'resize', 'select'];
const ALL: ActionKind[] = ['type', 'font', 'colour', 'resize', 'nudge', 'select'];

export const AGENTS: { name: string; skills: ActionKind[] }[] = [
  { name: 'Copywriter', skills: WRITING },
  { name: 'Art director', skills: DESIGN },
  { name: 'Claude', skills: ALL },
  { name: 'Brand agent', skills: ['colour', 'font', 'type'] },
  { name: 'Motion agent', skills: ['resize', 'nudge'] },
  { name: 'Codex', skills: ALL },
  { name: 'SEO agent', skills: WRITING },
  { name: 'Layout agent', skills: LAYOUT },
  { name: 'Type agent', skills: ['font', 'font', 'type'] },
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

const TYPO_CHANCE = 0.06;
const KEYS_NEAR = 'qwertyuiopasdfghjklzxcvbnm';
const SHORT_TEXT = 40;
const MAX_WORDS_REWRITTEN = 4;

function strike(char: string, rng: Rng): string {
  const lower = char.toLowerCase();
  const at = KEYS_NEAR.indexOf(lower);
  if (at < 0) {
    return char;
  }

  return KEYS_NEAR[(at + (rng() < 0.5 ? 1 : KEYS_NEAR.length - 1)) % KEYS_NEAR.length];
}

export function rewriteFrom(text: string, rng: Rng): number {
  if (text.length <= SHORT_TEXT) {
    return 0;
  }

  const spaces = [...text.matchAll(/ /g)].map((m) => m.index + 1);
  const words = 1 + Math.floor(rng() * MAX_WORDS_REWRITTEN);
  return spaces[Math.max(0, spaces.length - words)] ?? 0;
}

export function typeFrames(text: string, keep: number, rng: Rng): string[] {
  const frames: string[] = [];

  if (keep > 0) {
    for (let i = text.length - 1; i >= keep; i--) {
      frames.push(text.slice(0, i));
    }
  }

  for (let i = keep; i < text.length; i++) {
    const typed = text.slice(0, i);
    const wrong = strike(text[i], rng);
    if (wrong !== text[i] && rng() < TYPO_CHANCE) {
      frames.push(typed + wrong, typed + wrong + strike(text[i + 1] ?? 'e', rng), typed + wrong, typed);
    }
    frames.push(typed + text[i]);
  }

  return frames;
}

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

export const BUILD_CLASS = 'agents-build';
export const BUILD_FALLBACK_MS = 4000;
export const BUILD_SELECTOR = [
  '.bar > a',
  '.bar .links > a',
  '.bar .actions > a',
  '.bar > button',
  'main [data-agent-id]',
  'main :is(h2, h3, p, li, img, video, pre, button, summary, input, label, [role="tablist"])',
  '.site-foot :is(h2, p, a)'
].join(', ');

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export const BUILD_HEAD = `<style>.${BUILD_CLASS} :is(${BUILD_SELECTOR}){transition:opacity 250ms}.${BUILD_CLASS} :is(${BUILD_SELECTOR}):not([data-built]){opacity:0!important}</style><script>(()=>{if(matchMedia('${REDUCED_MOTION}').matches){return}const r=document.documentElement;r.classList.add('${BUILD_CLASS}');setTimeout(()=>{if(!r.dataset.agents){r.classList.remove('${BUILD_CLASS}')}},${BUILD_FALLBACK_MS})})()</script>`;

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

export function thin<T>(frames: T[], max: number): T[] {
  const every = Math.ceil(frames.length / max);
  return frames.filter((_, i) => i % every === 0 || i === frames.length - 1);
}

export type TweakLedger<T> = { done: Set<T>; active: Set<T>; lastAt: number };

export function createLedger<T>(): TweakLedger<T> {
  return { done: new Set(), active: new Set(), lastAt: -Infinity };
}

export enum TweakLimit {
  Once = 'once',
  Unlimited = 'unlimited'
}

export type ElementRule = { selector: string; crew: number; limit: TweakLimit; beats: ActionKind[] };

export const ELEMENT_RULES: ElementRule[] = [
  { selector: '.site-foot .mark', crew: 4, limit: TweakLimit.Unlimited, beats: ['type', 'font', 'colour', 'tracking', 'resize', 'select'] },
  { selector: '*', crew: 0, limit: TweakLimit.Once, beats: [] }
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
