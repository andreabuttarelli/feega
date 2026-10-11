import { z } from 'zod';

export enum CursorAction {
  Move = 'move',
  Hover = 'hover',
  Click = 'click',
  Type = 'type',
  Scroll = 'scroll'
}

export enum CursorShape {
  Arrow = 'arrow',
  Hand = 'hand',
  Beam = 'beam'
}

export const NODE_ID = z.string().regex(/^[a-z]+-\d+$/, 'an element id of the recreated UI, e.g. button-0, input-0, text-3');

export const CURSOR_STEP = z
  .object({
    target: NODE_ID.describe('the element of the recreated UI the cursor goes to'),
    action: z.enum(CursorAction).describe('move: only travel there; hover: rest on it (hover state); click: press it (pressed state, ripple); type: click the field and type text at a human pace; scroll: wheel the page by text pixels'),
    text: z.string().trim().min(1).max(48).optional().describe('type: the characters typed; scroll: the pixels scrolled (default a quarter of the page)'),
    at: z.number().min(0).max(4).optional().describe('second of the shot the cursor arrives and acts; omitted, the steps follow each other at the house pace')
  })
  .strict();

export const CURSOR_SLOT = z.array(CURSOR_STEP).min(1).max(8).describe('the cursor script of the shot; omitted, the shot writes one from the roles of its elements');

export type CursorStep = z.infer<typeof CURSOR_STEP>;

export const CURSOR_GUIDE = 'cursor is a list of up to 8 steps { target, action, text?, at? }: target an element id of the recreated UI; action move (travel there), hover (rest on it, hover state), click (press it: pressed state and ripple), type (click the field and type text at a human pace) or scroll (wheel the page by text pixels); at the second of the shot the cursor arrives, omitted the steps follow each other at the house pace.';

export type CursorBox = { x: number; y: number; w: number; h: number; role: string };
export type CursorUi = { width: number; height: number; box: (id: string) => CursorBox | null };

export function cursorMath() {
  const START = 0.2;
  const TRAVEL = 0.6;
  const GAP = 0.12;
  const TAIL = 0.6;
  const CPS = 14;
  const TYPE_LEAD = 0.18;
  const PRESS = 0.2;
  const RIPPLE = 0.5;
  const SETTLE = 0.22;
  const OVERSHOOT = 0.04;
  const BEND = 0.2;
  const FADE = 0.25;
  const SHAPE_LEAD = 0.08;
  const LIT = 0.2;
  const EXPO = 6;
  const SCROLL_SHARE = 0.25;

  const DWELL: Record<string, (text: string) => number> = {
    move: () => 0.05,
    hover: () => 0.5,
    click: () => 0.3,
    type: (text) => TYPE_LEAD + Math.min(1.6, Math.max(0.4, text.length / CPS)),
    scroll: () => 0.8
  };
  const PRESSES: Record<string, boolean> = { click: true, type: true };
  const ROLE_ACTION: Record<string, string> = { input: 'type', button: 'click', link: 'click', icon: 'click' };
  const ROLE_SHAPE: Record<string, string> = { input: 'beam', link: 'hand' };

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const half = (p: number) => (Math.pow(2, EXPO * (2 * p - 1)) - Math.pow(2, -EXPO)) / (2 * (1 - Math.pow(2, -EXPO)));
  const glide = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? half(p) : 1 - half(1 - p));
  const out = (p: number) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

  type Point = { x: number; y: number };
  type Resolved = { target: string; action: string; text: string; at: number; end: number; travel: number; to: Point; from: Point; role: string; scroll: number };

  function auto(entries: readonly { id: string; text?: string }[], ui: CursorUi) {
    return entries.flatMap((e) => {
      const box = ui.box(e.id);
      if (!box) {
        return [];
      }
      const action = ROLE_ACTION[box.role] ?? 'hover';
      if (action === 'type' && !e.text) {
        return [{ target: e.id, action: 'click' }];
      }
      return [action === 'type' ? { target: e.id, action, text: e.text } : { target: e.id, action }];
    });
  }

  function plan(script: readonly { target: string; action: string; text?: string; at?: number }[], ui: CursorUi, duration: number) {
    const known = script.filter((s) => ui.box(s.target) && DWELL[s.action]);
    const timed = known.some((s) => s.at !== undefined);
    let cursor = START;
    const raw = known.map((s) => {
      const text = s.text ?? '';
      const at = s.at ?? cursor + TRAVEL;
      const end = at + DWELL[s.action](text);
      cursor = end + GAP;
      return { s, text, at, end };
    });
    const last = raw.length ? raw[raw.length - 1].end : 0;
    const room = duration - TAIL;
    const k = !timed && last > room && last > START ? Math.max(0.4, (room - START) / (last - START)) : 1;
    const squeeze = (t: number) => START + (t - START) * k;

    const steps: Resolved[] = [];
    raw.forEach(({ s, text, at, end }) => {
      const box = ui.box(s.target) as CursorBox;
      const to = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
      const prev = steps[steps.length - 1];
      const from = prev ? { x: prev.to.x, y: prev.to.y + prev.scroll } : { x: to.x + ui.width * 0.22, y: to.y + ui.height * 0.3 };
      const a = squeeze(at);
      const floor = prev ? prev.end : 0;
      const travel = Math.max(floor, a - TRAVEL * k, 0);
      const scroll = s.action === 'scroll' ? Number(text) || ui.height * SCROLL_SHARE : 0;
      steps.push({ target: s.target, action: s.action, text, at: a, end: squeeze(end), travel: Math.min(travel, a), to, from, role: box.role, scroll });
    });
    return { steps };
  }

  type Plan = ReturnType<typeof plan>;

  function curve(a: Point, b: Point, p: number): Point {
    const c = { x: (a.x + b.x) / 2 - (b.y - a.y) * BEND, y: (a.y + b.y) / 2 + (b.x - a.x) * BEND };
    const q = 1 - p;
    return { x: q * q * a.x + 2 * q * p * c.x + p * p * b.x, y: q * q * a.y + 2 * q * p * c.y + p * p * b.y };
  }

  function placeAt(step: Resolved, t: number): Point {
    const dist = Math.hypot(step.to.x - step.from.x, step.to.y - step.from.y) || 1;
    const past = { x: step.to.x + ((step.to.x - step.from.x) / dist) * OVERSHOOT * dist, y: step.to.y + ((step.to.y - step.from.y) / dist) * OVERSHOOT * dist };
    const settle = Math.min(SETTLE, (step.at - step.travel) / 3);
    const turn = step.at - settle;
    if (t < turn) {
      return curve(step.from, past, glide((t - step.travel) / Math.max(0.001, turn - step.travel)));
    }
    if (t < step.at) {
      const p = glide((t - turn) / Math.max(0.001, settle));
      return { x: past.x + (step.to.x - past.x) * p, y: past.y + (step.to.y - past.y) * p };
    }
    return { x: step.to.x, y: step.to.y + step.scroll * glide((t - step.at) / Math.max(0.001, step.end - step.at)) };
  }

  function pose(p: Plan, t: number) {
    const steps = p.steps;
    if (!steps.length) {
      return { x: 0, y: 0, opacity: 0, shape: 'arrow', press: 0, ripple: null as null | { x: number; y: number; p: number }, hover: null as string | null, lit: 0, typed: [] as { target: string; text: string; p: number }[], scroll: 0 };
    }
    let i = -1;
    steps.forEach((s, k) => {
      if (s.travel <= t) {
        i = k;
      }
    });
    const step = steps[Math.max(0, i)];
    const point = i < 0 ? step.from : placeAt(step, t);
    const arrived = i >= 0 && t >= step.at - SHAPE_LEAD;
    const press = Math.max(0, ...steps.filter((s) => PRESSES[s.action] && t >= s.at && t <= s.at + PRESS).map((s) => Math.sin((Math.PI * (t - s.at)) / PRESS)));
    const clicked = steps.filter((s) => PRESSES[s.action] && t >= s.at && t < s.at + RIPPLE).pop();
    const typed = steps.filter((s) => s.action === 'type' && t >= s.at + TYPE_LEAD).map((s) => ({ target: s.target, text: s.text, p: clamp((t - s.at - TYPE_LEAD) / Math.max(0.001, s.end - s.at - TYPE_LEAD), 0, 1) }));
    const rested = steps.filter((s) => s.action !== 'scroll' && t >= s.at - SHAPE_LEAD).pop();
    const scroll = steps.reduce((sum, s) => sum + s.scroll * glide((t - s.at) / Math.max(0.001, s.end - s.at)), 0);
    return {
      x: point.x,
      y: point.y,
      opacity: out((t - (steps[0].travel - FADE)) / FADE),
      shape: arrived ? (ROLE_SHAPE[step.role] ?? 'arrow') : 'arrow',
      press,
      ripple: clicked ? { x: clicked.to.x, y: clicked.to.y, p: (t - clicked.at) / RIPPLE } : null,
      hover: rested ? rested.target : null,
      lit: rested ? clamp((t - rested.at + SHAPE_LEAD) / LIT, 0, 1) * (1 - clamp((t - (steps[steps.indexOf(rested) + 1]?.travel ?? Infinity)) / LIT, 0, 1)) : 0,
      typed,
      scroll
    };
  }

  return { auto, plan, pose };
}

export type CursorPose = ReturnType<ReturnType<typeof cursorMath>['pose']>;

export const cursorSource = () => `(${cursorMath.toString()})()`;
