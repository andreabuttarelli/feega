export type DemoState = Readonly<Record<string, string>>;

export type Point = { readonly x: number; readonly y: number };

export type Focus = Point;

export type Aim = { readonly target: string; readonly dx: number; readonly dy: number };

export type Step = {
  readonly at: number;
  readonly target?: string;
  readonly dx?: number;
  readonly dy?: number;
  readonly travel?: number;
  readonly press?: number;
  readonly set?: DemoState;
  readonly focus?: Focus;
};

export type Script = {
  readonly duration: number;
  readonly poster: number;
  readonly rest: Aim;
  readonly initial: DemoState;
  readonly steps: readonly Step[];
};

export type CursorFrame = { readonly from: Aim; readonly to: Aim; readonly progress: number };

export type Frame = {
  readonly state: DemoState;
  readonly focus: Focus | undefined;
  readonly cursor: CursorFrame;
  readonly pressed: boolean;
  readonly ring: number | undefined;
};

export enum Key {
  Menu = 'menu',
  State = 'state',
  Chip = 'chip',
  Reach = 'reach',
  Padding = 'padding',
  Scope = 'scope',
  Value = 'value',
  Dot = 'dot',
  Alt = 'alt',
  Theme = 'theme',
  Fit = 'fit',
  Colour = 'colour',
  Inserted = 'inserted',
  Row = 'row',
  Diff = 'diff',
  Card = 'card'
}

export const ON = 'on';
export const OFF = '';

export const TRAVEL_MS = 800;
export const RETURN_MS = 900;
export const CLICK_MS = 180;
export const RING_MS = 450;

export const targetSelector = (name: string): string => `[data-t="${name}"]`;

export const easeInOutExpo = (p: number): number => {
  if (p <= 0) {
    return 0;
  }

  if (p >= 1) {
    return 1;
  }

  return p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2;
};

const aimOf = (step: Step): Aim => ({ target: step.target ?? '', dx: step.dx ?? 0, dy: step.dy ?? 0 });

type Waypoint = { readonly arrive: number; readonly travel: number; readonly aim: Aim };

export const waypoints = (script: Script): readonly Waypoint[] => [
  { arrive: 0, travel: 0, aim: script.rest },
  ...script.steps.filter((s) => s.target).map((s) => ({ arrive: s.at, travel: s.travel ?? TRAVEL_MS, aim: aimOf(s) })),
  { arrive: script.duration, travel: RETURN_MS, aim: script.rest }
];

export const stateAt = (script: Script, t: number): DemoState =>
  script.steps.filter((s) => s.set && s.at <= t).reduce<DemoState>((state, s) => ({ ...state, ...s.set }), script.initial);

const focusAt = (script: Script, t: number): Focus | undefined => script.steps.filter((s) => s.focus && s.at <= t).at(-1)?.focus;

const cursorAt = (script: Script, t: number): CursorFrame => {
  const points = waypoints(script);
  const index = points.findLastIndex((w) => w.arrive <= t);
  const from = points[index].aim;
  const next = points[index + 1];
  const start = next.arrive - next.travel;

  if (t <= start) {
    return { from, to: from, progress: 0 };
  }

  return { from, to: next.aim, progress: easeInOutExpo((t - start) / next.travel) };
};

const pressStep = (script: Script, t: number): Step | undefined =>
  script.steps.find((s) => s.press !== undefined && s.at <= t && t < s.at + s.press + RING_MS);

export const frameAt = (script: Script, t: number): Frame => {
  const press = pressStep(script, t);
  const age = press ? t - press.at : 0;

  return {
    state: stateAt(script, t),
    focus: focusAt(script, t),
    cursor: cursorAt(script, t),
    pressed: press !== undefined && age < (press.press ?? 0),
    ring: press ? Math.min(age / RING_MS, 1) : undefined
  };
};
