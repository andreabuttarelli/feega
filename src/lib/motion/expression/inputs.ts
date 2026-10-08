export enum InputKey {
  PointerX = 'pointer.x',
  PointerY = 'pointer.y',
  PointerDown = 'pointer.down',
  Hover = 'hover',
  TiltX = 'tilt.x',
  TiltY = 'tilt.y',
  Scroll = 'scroll',
  Time = 'time'
}

export enum Crossing {
  Local = 'local',
  Global = 'global'
}

type InputSpec = { fallback: (seconds: number) => number; crossing: Crossing; about: string };

const constant = (n: number) => () => n;

export const INPUTS: Record<InputKey, InputSpec> = {
  [InputKey.PointerX]: { fallback: constant(0.5), crossing: Crossing.Local, about: 'cursor or finger across the player, 0 left .. 1 right' },
  [InputKey.PointerY]: { fallback: constant(0.5), crossing: Crossing.Local, about: 'cursor or finger down the player, 0 top .. 1 bottom' },
  [InputKey.PointerDown]: { fallback: constant(0), crossing: Crossing.Global, about: '1 while pressed' },
  [InputKey.Hover]: { fallback: constant(0), crossing: Crossing.Local, about: '1 while the cursor is over the player (or over the layer box it lives in)' },
  [InputKey.TiltX]: { fallback: constant(0), crossing: Crossing.Global, about: 'phone tilted left -1 .. right 1' },
  [InputKey.TiltY]: { fallback: constant(0), crossing: Crossing.Global, about: 'phone tilted away -1 .. towards 1' },
  [InputKey.Scroll]: { fallback: constant(0), crossing: Crossing.Global, about: 'how far the host page is scrolled, 0 top .. 1 bottom' },
  [InputKey.Time]: { fallback: (seconds) => seconds, crossing: Crossing.Global, about: 'real seconds since the player started (the timeline time when absent)' }
};

export const INPUT_KEYS = Object.values(InputKey);

export type InputValues = Partial<Record<InputKey, number>>;

export type InputPort = { read: (key: InputKey) => number; smooth: (slot: number, target: number, seconds: number) => number };

export function fallbackPort(seconds: number): InputPort {
  return { read: (key) => INPUTS[key].fallback(seconds), smooth: (_slot, target) => target };
}

export function valuesPort(values: InputValues, seconds: number, smooth: InputPort['smooth']): InputPort {
  return { read: (key) => values[key] ?? INPUTS[key].fallback(seconds), smooth };
}

export type Point = [number, number];

export type Crossed = { values: InputValues; inside: boolean };

const CROSS: Record<Crossing, (key: InputKey, outer: InputValues, local: InputValues) => number | undefined> = {
  [Crossing.Global]: (key, outer) => outer[key],
  [Crossing.Local]: (key, _outer, local) => local[key]
};

const within = (n: number) => n >= 0 && n <= 1;

export type Level = { toLocal: (p: Point) => Point; contains?: (p: Point) => boolean };

function localPointer(outer: InputValues, level: Level): Crossed {
  const x = outer[InputKey.PointerX];
  const y = outer[InputKey.PointerY];
  if (x === undefined || y === undefined) {
    return { values: {}, inside: false };
  }
  const [lx, ly] = level.toLocal([x, y]);
  const inside = within(lx) && within(ly) && (level.contains?.([x, y]) ?? true);
  return { values: { [InputKey.PointerX]: lx, [InputKey.PointerY]: ly, [InputKey.Hover]: inside ? (outer[InputKey.Hover] ?? 0) : 0 }, inside };
}

export function crossLevel(outer: InputValues, level: Level): Crossed {
  const local = localPointer(outer, level);
  const values: InputValues = {};
  for (const key of INPUT_KEYS) {
    const value = CROSS[INPUTS[key].crossing](key, outer, local.values);
    if (value !== undefined) {
      values[key] = value;
    }
  }
  return { values, inside: local.inside };
}

const READS_INPUT = /\binput\s*\./;

export function readsInput(source: string): boolean {
  return READS_INPUT.test(source);
}

export const INPUT_GUIDE = `Live input (interactive web export only): ${INPUT_KEYS.map((k) => `input.${k} (${INPUTS[k].about})`).join('; ')}; input.smooth(v, seconds) eases v towards its target over about that many seconds. In the preview, in video renders and when an input is missing every input reads its default (pointer 0.5, tilt/scroll/hover/down 0, time = timeline seconds), so videos stay identical. Inside a precomp the cursor reads in that precomp's own box. Live input drives transforms, number props and liquid glass/blob props; on any other property it is refused.`;
