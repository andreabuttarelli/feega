import type { Spring, SpringMath, Step } from '../spring';

export const MORPH_KINDS = ['button', 'loader', 'check', 'island', 'player', 'slider', 'toggle', 'tabs', 'chart', 'palette', 'toast'] as const;
export type MorphKind = (typeof MORPH_KINDS)[number];

export const DEFAULT_REEL: readonly MorphKind[] = ['loader', 'check', 'island', 'player', 'slider', 'toggle', 'tabs', 'chart', 'palette', 'toast', 'button'];

export type Role = 'ink' | 'paper' | 'accent' | 'mute';
export type Point = readonly [x: number, y: number];
export type ReelInput = { states: readonly MorphKind[]; bpm: number; offset: number; frame: number; palette: Record<Role, string>; beatsPerStep?: number };
export type Sound = { at: number; kind: 'press' | 'release' | 'key' | 'morph' | 'tick' };
export type ReelFrame = { values: Record<string, number>; typed: string; velocity: Record<string, number> };

export function reelMath(S: SpringMath) {
  const SPRING = {
    ui: { stiffness: 320, damping: 30 },
    soft: { stiffness: 150, damping: 25 },
    camera: { stiffness: 150, damping: 25 },
    cursorX: { stiffness: 90, damping: 19 },
    cursorY: { stiffness: 70, damping: 17 },
    drag: { stiffness: 60, damping: 15 },
    press: { stiffness: 1400, damping: 75 },
    draw: { stiffness: 45, damping: 14 },
    lead: { stiffness: 520, damping: 44 },
    trail: { stiffness: 150, damping: 25 }
  };
  const CHANNEL_SPRING: Record<string, Spring> = {
    bgR: SPRING.soft,
    bgG: SPRING.soft,
    bgB: SPRING.soft,
    cam: SPRING.camera,
    curX: SPRING.cursorX,
    curY: SPRING.cursorY,
    press: SPRING.press,
    flash: SPRING.press,
    draw: SPRING.draw,
    tick: SPRING.soft,
    toastTick: SPRING.soft,
    arc: SPRING.soft,
    data: SPRING.soft
  };
  const ENTER_DELAY = 0.1;
  const PRESS_LEAD = 0.05;
  const PRESS_HOLD = 0.09;
  const BEATS_PER_STEP = 2;
  const CURSOR_LEAD = 0.62;
  const CURVE_LAG = 0.07;
  const TYPE_GAP = 0.09;
  const RUBBER = 0.32;
  const FILL_W = 0.74;
  const FILL_H = 0.56;
  const MAX_ZOOM = 3.4;
  const REFERENCE_FRAME = 1080;
  const ITEMS = ['Export chart', 'Export as CSV', 'Expand view', 'Share link', 'Settings'];
  const SERIES = [
    [0.22, 0.3, 0.26, 0.42, 0.38, 0.55, 0.5, 0.64, 0.6, 0.78, 0.72, 0.9],
    [0.6, 0.52, 0.58, 0.44, 0.5, 0.36, 0.42, 0.3, 0.38, 0.26, 0.34, 0.2]
  ];
  const CHART = { x0: -290, x1: 290, y0: 190, y1: -110 };
  const TOGGLE_OFF = [-74, 2];
  const TOGGLE_ON = [-2, 74];
  const TABS = { centers: [-180, 0, 180], half: 86, y: 0, h: 76 };
  const CHART_TABS = { centers: [-236, -120, -4], half: 56, y: -186, h: 52 };
  const PROGRESS = { x0: -252, x1: 252, y: 62 };
  const VOLUME = { x0: -170, x1: 226, y: 0 };
  const IDLE: Point = [236, 150];

  type Key = { at: number; value: number; spring: Spring };
  type Drag = { channel: string; press: number; release: number; x0: number; x1: number; rubber: number; settle: number };
  type Box = { w: number; h: number; r: number; bg: Role };
  type Edges = [lo: number, hi: number, y: number, h: number];
  type Cue = { beat: number; cursor?: Point; click?: boolean; knob?: Edges; drag?: { to: Point; channel: string; x0: number; x1: number; rubber: number; settle: number }; set?: Record<string, number>; type?: string; key?: boolean };
  type Kind = { box: Box; beats: number; leave: { click?: Point; key?: boolean }; enter: Record<string, number>; knob?: Edges; cues: Cue[] };

  const tabEdges = (tabs: typeof TABS, i: number): Edges => [tabs.centers[i] - tabs.half, tabs.centers[i] + tabs.half, tabs.y, tabs.h];

  const pointOf = (i: number, series: number[]): Point => [CHART.x0 + (i / (series.length - 1)) * (CHART.x1 - CHART.x0), CHART.y0 + series[i] * (CHART.y1 - CHART.y0)];

  const LIBRARY: Record<string, Kind> = {
    button: { box: { w: 300, h: 88, r: 44, bg: 'ink' }, beats: 2, leave: { click: [26, 14] }, enter: {}, cues: [{ beat: 1, cursor: [26, 14], set: { hover: 1 } }] },
    loader: { box: { w: 88, h: 88, r: 44, bg: 'ink' }, beats: 2, leave: {}, enter: { arc: 0.22, hover: 0 }, cues: [{ beat: 1, set: { arc: 0.8 } }] },
    check: { box: { w: 96, h: 96, r: 48, bg: 'accent' }, beats: 1, leave: {}, enter: { tick: 1, arc: 0 }, cues: [] },
    island: { box: { w: 340, h: 72, r: 36, bg: 'ink' }, beats: 1, leave: { click: [0, 6] }, enter: { tick: 0 }, cues: [] },
    player: {
      box: { w: 600, h: 220, r: 44, bg: 'ink' },
      beats: 4,
      leave: { click: [244, -40] },
      enter: { play: 0, prog: 0.28 },
      cues: [
        { beat: 1, cursor: [150, -40], click: true, set: { play: 1 } },
        { beat: 2, cursor: [PROGRESS.x0 + 0.28 * (PROGRESS.x1 - PROGRESS.x0), PROGRESS.y], drag: { to: [PROGRESS.x0 + 0.74 * (PROGRESS.x1 - PROGRESS.x0), PROGRESS.y + 6], channel: 'prog', x0: PROGRESS.x0, x1: PROGRESS.x1, rubber: 0, settle: 0.74 } }
      ]
    },
    slider: {
      box: { w: 560, h: 104, r: 52, bg: 'paper' },
      beats: 3,
      leave: {},
      enter: { vol: 0.45 },
      cues: [{ beat: 1, cursor: [VOLUME.x0 + 0.45 * (VOLUME.x1 - VOLUME.x0), VOLUME.y + 4], drag: { to: [VOLUME.x1 + 150, VOLUME.y + 10], channel: 'vol', x0: VOLUME.x0, x1: VOLUME.x1, rubber: RUBBER, settle: 1 } }]
    },
    toggle: { box: { w: 168, h: 96, r: 48, bg: 'mute' }, beats: 2, leave: { click: [36, 4] }, enter: { on: 0 }, knob: [TOGGLE_OFF[0], TOGGLE_OFF[1], 0, 76], cues: [{ beat: 1, cursor: [-36, 4], click: true, set: { on: 1 }, knob: [TOGGLE_ON[0], TOGGLE_ON[1], 0, 76] }] },
    tabs: { box: { w: 560, h: 96, r: 48, bg: 'paper' }, beats: 3, leave: { click: [180, 4] }, enter: { on: 0 }, knob: tabEdges(TABS, 0), cues: [{ beat: 1, cursor: [0, 4], click: true, knob: tabEdges(TABS, 1) }, { beat: 2, cursor: [180, 4], click: true, knob: tabEdges(TABS, 2) }] },
    chart: {
      box: { w: 680, h: 480, r: 40, bg: 'paper' },
      beats: 4,
      leave: { key: true },
      enter: { draw: 1, data: 0, tip: 0, tipI: 6 },
      knob: tabEdges(CHART_TABS, 2),
      cues: [
        { beat: 1, cursor: pointOf(6, SERIES[0]), set: { tip: 1, tipI: 6 } },
        { beat: 2, cursor: pointOf(9, SERIES[0]), set: { tipI: 9 } },
        { beat: 3, cursor: [CHART_TABS.centers[0], CHART_TABS.y + 4], click: true, set: { data: 1, tip: 0 }, knob: tabEdges(CHART_TABS, 0) }
      ]
    },
    palette: {
      box: { w: 660, h: 480, r: 32, bg: 'paper' },
      beats: 4,
      leave: { key: true },
      enter: { draw: 0, sel: 0, flash: 0 },
      cues: [{ beat: 1, type: 'ex', cursor: IDLE }, { beat: 2, type: 'expo' }, { beat: 3, key: true, set: { sel: 1 } }]
    },
    toast: { box: { w: 420, h: 84, r: 42, bg: 'ink' }, beats: 2, leave: {}, enter: { toastTick: 0 }, cues: [{ beat: 1, set: { toastTick: 1 } }] }
  };

  const kindOf = (name: string): Kind => {
    const kind = LIBRARY[name];
    if (!kind) {
      throw new Error(`unknown state ${name}: one of ${Object.keys(LIBRARY).join(', ')}`);
    }
    return kind;
  };

  const hex = (colour: string): [number, number, number] => {
    const h = colour.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  };

  const fit = (box: Pick<Box, 'w' | 'h'>, frame: number): number => Math.min((FILL_W * frame) / box.w, (FILL_H * frame) / box.h, (MAX_ZOOM * frame) / REFERENCE_FRAME);

  const plan = (input: ReelInput) => {
    const beat = 60 / input.bpm;
    const step = beat * (input.beatsPerStep ?? BEATS_PER_STEP);
    const kinds = input.states.map(kindOf);
    const period = kinds.reduce((sum, k) => sum + k.beats, 0) * step;
    const cues: number[] = [];
    const keys: Record<string, Key[]> = {};
    const edges: { at: number; lo: number; hi: number }[] = [];
    const drags: Drag[] = [];
    const typing: { at: number; text: string }[] = [];
    const sounds: Sound[] = [];
    const wrap = (t: number) => ((t % period) + period) % period;
    const time = (b: number) => wrap(input.offset + b * step);
    const put = (channel: string, at: number, value: number, spring?: Spring) => (keys[channel] = keys[channel] || []).push({ at: wrap(at), value, spring: spring ?? CHANNEL_SPRING[channel] ?? (channel.startsWith('in:') ? SPRING.soft : SPRING.ui) });
    const putAll = (values: Record<string, number>, at: number) => Object.entries(values).forEach(([k, v]) => put(k, at, v));
    const moveCursor = (to: Point, at: number) => {
      put('curX', at - CURSOR_LEAD, to[0]);
      put('curY', at - CURSOR_LEAD + CURVE_LAG, to[1]);
    };
    const click = (at: number) => {
      put('press', at - PRESS_LEAD, 1);
      put('press', at + PRESS_HOLD, 0);
      sounds.push({ at: wrap(at - PRESS_LEAD), kind: 'press' }, { at: wrap(at + PRESS_HOLD), kind: 'release' });
    };
    const knob = (k: Edges, at: number) => {
      edges.push({ at, lo: k[0], hi: k[1] });
      put('knobY', at, k[2]);
      put('knobH', at, k[3]);
    };

    let b = 0;
    input.states.forEach((name, i) => {
      const kind = kinds[i];
      const previous = kinds[(i + kinds.length - 1) % kinds.length];
      const at = time(b);
      const palette = hex(input.palette[kind.box.bg]);

      put('w', at, kind.box.w);
      put('h', at, kind.box.h);
      put('r', at, kind.box.r);
      ['bgR', 'bgG', 'bgB'].forEach((c, n) => put(c, at, palette[n]));
      put('cam', at, fit(kind.box, input.frame));
      put(`in:${name}`, at + ENTER_DELAY, 1);
      put(`in:${input.states[(i + kinds.length - 1) % kinds.length]}`, at, 0, SPRING.ui);
      put('knob', at, kind.knob ? 1 : 0);
      if (kind.knob) {
        knob(kind.knob, at);
      }
      putAll(kind.enter, at);
      sounds.push({ at, kind: 'morph' });
      cues.push(at);

      if (previous.leave.click) {
        moveCursor(previous.leave.click, at);
        click(at);
      }
      if (previous.leave.key) {
        put('flash', at - PRESS_LEAD, 1);
        put('flash', at + PRESS_HOLD, 0);
        sounds.push({ at, kind: 'key' });
      }
      if (name === 'palette') {
        typing.push({ at, text: '' });
        ITEMS.forEach((_, row) => put(`row${row}`, at, 1));
      }

      for (const cue of kind.cues) {
        const c = time(b + cue.beat);
        cues.push(c);
        if (cue.cursor) {
          moveCursor(cue.cursor, c);
        }
        if (cue.click) {
          click(c);
        }
        if (cue.set) {
          putAll(cue.set, c);
        }
        if (!cue.click && !cue.key && !cue.drag && !cue.type) {
          sounds.push({ at: c, kind: 'tick' });
        }
        if (cue.knob) {
          knob(cue.knob, c);
        }
        if (cue.key) {
          put('flash', c - PRESS_LEAD, 1);
          put('flash', c + PRESS_HOLD, 0);
          sounds.push({ at: c, kind: 'key' });
        }
        if (cue.type) {
          const before = typing[typing.length - 1]?.text ?? '';
          for (let n = before.length + 1; n <= cue.type.length; n++) {
            const typed = cue.type.slice(0, n);
            const t = c + (n - before.length - 1) * TYPE_GAP;
            typing.push({ at: wrap(t), text: typed });
            sounds.push({ at: wrap(t), kind: 'key' });
            ITEMS.forEach((item, row) => put(`row${row}`, t, item.toLowerCase().startsWith(typed) ? 1 : 0));
          }
        }
        if (cue.drag) {
          const release = time(b + cue.beat + 1);
          cues.push(release);
          put('press', c, 1);
          put('press', release, 0);
          put('curX', c, cue.drag.to[0], SPRING.drag);
          put('curY', c, cue.drag.to[1], SPRING.drag);
          put(cue.drag.channel, release, cue.drag.settle);
          drags.push({ channel: cue.drag.channel, press: c, release, x0: cue.drag.x0, x1: cue.drag.x1, rubber: cue.drag.rubber, settle: cue.drag.settle });
          sounds.push({ at: c, kind: 'press' }, { at: release, kind: 'release' });
        }
      }
      b += kind.beats;
    });

    const steps: Record<string, { base: number; steps: Step[] }> = {};
    for (const [channel, list] of Object.entries(keys)) {
      const sorted = list.slice().sort((x, y) => x.at - y.at);
      const base = sorted[sorted.length - 1].value;
      let last = base;
      const out: Step[] = [];
      for (const k of sorted) {
        if (k.value !== last) {
          out.push({ at: k.at, delta: k.value - last, spring: k.spring });
        }
        last = k.value;
      }
      steps[channel] = { base, steps: out };
    }

    const sortedEdges = edges.slice().sort((x, y) => x.at - y.at);
    const settled = sortedEdges[sortedEdges.length - 1] ?? { lo: 0, hi: 0 };
    const edgeKeys = [[0, settled.lo, settled.hi] as const, ...sortedEdges.map((e) => [e.at, e.lo, e.hi] as const)];
    const pair = S.edgeChanges(edgeKeys, SPRING.lead, SPRING.trail);
    steps.knobLo = { base: edgeKeys[0][1], steps: pair.lo.filter((s) => s.delta !== 0) };
    steps.knobHi = { base: edgeKeys[0][2], steps: pair.hi.filter((s) => s.delta !== 0) };

    typing.sort((x, y) => x.at - y.at);
    sounds.sort((x, y) => x.at - y.at);
    cues.sort((x, y) => x - y);
    return { period, beat, step, cues, frame: input.frame, steps, drags, typing, sounds, palette: input.palette, states: input.states.slice() };
  };

  type Plan = ReturnType<typeof plan>;

  const channelAt = (p: Plan, channel: string, t: number): [number, number] => {
    const c = p.steps[channel];
    if (!c) {
      return [0, 0];
    }
    return [S.sumSteps(c.base, c.steps, t, p.period), S.sumVelocity(c.steps, t, p.period)];
  };

  const dragged = (d: Drag, x: number, vx: number): [number, number] => {
    const u = (x - d.x0) / (d.x1 - d.x0);
    const du = vx / (d.x1 - d.x0);
    if (u <= 1 || d.rubber === 0) {
      return [Math.max(0, Math.min(1, u)), u < 0 || (u > 1 && d.rubber === 0) ? 0 : du];
    }
    return [1 + (u - 1) * d.rubber, du * d.rubber];
  };

  const valueAt = (p: Plan, channel: string, t: number): [number, number] => {
    const [x, v] = channelAt(p, channel, t);
    const d = p.drags.find((g) => g.channel === channel);
    if (!d) {
      return [x, v];
    }
    if (t >= d.press && t < d.release) {
      return dragged(d, ...channelAt(p, 'curX', t));
    }
    const [at, vel] = dragged(d, ...channelAt(p, 'curX', d.release));
    const before = channelAt(p, channel, d.release - 1e-9)[0];
    const since = t >= d.release ? t - d.release : t + p.period - d.release;
    const [ex, ev] = S.kernel(SPRING.ui.stiffness, SPRING.ui.damping, since, at - before, vel);
    return [x + ex, v + ev];
  };

  const frameAt = (p: Plan, time: number): ReelFrame => {
    const t = ((time % p.period) + p.period) % p.period;
    const values: Record<string, number> = {};
    const velocity: Record<string, number> = {};
    for (const channel of Object.keys(p.steps)) {
      const [x, v] = valueAt(p, channel, t);
      values[channel] = x;
      velocity[channel] = v;
    }
    values.t = t;
    const typed = p.typing.filter((k) => k.at <= t).pop() ?? p.typing[p.typing.length - 1];
    return { values, velocity, typed: typed ? typed.text : '' };
  };

  const channel = (p: Plan, name: string, time: number): number => (p.steps[name] ? valueAt(p, name, ((time % p.period) + p.period) % p.period)[0] : 0);

  return { plan, frameAt, channel, fit, library: LIBRARY, items: ITEMS, series: SERIES, chart: CHART, progress: PROGRESS, volume: VOLUME, toggle: { off: TOGGLE_OFF, on: TOGGLE_ON } };
}

export type ReelMath = ReturnType<typeof reelMath>;
export type ReelPlan = ReturnType<ReelMath['plan']>;
