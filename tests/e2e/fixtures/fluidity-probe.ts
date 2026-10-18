import sharp from 'sharp';
import type { CDPSession, Page } from '@playwright/test';

export type Box = { x: number; y: number; width: number; height: number };
export type Watch = { id: string; selector: string; read: Read };
export enum Read {
  Box = 'box',
  Value = 'value',
  Text = 'text'
}

export type PixelWatch = { id: string; box: Box; touched: boolean };

export type StepFacts = {
  remounts: string[];
  playerMounts: string[];
  gpuCounts: Record<string, number>;
  fetches: string[];
  flashes: string[];
  reverts: string[];
  latencyP95: number | null;
  latencyMax: number | null;
  inputs: number;
  frameP95: number | null;
  frames: number;
  longTasks: number;
  longTaskMax: number;
  pixelFrames: number;
};

type PageResult = {
  removed: string[];
  playerMounts: string[];
  frameDeltas: number[];
  latencies: number[];
  longTasks: number[];
  sequences: Record<string, string[]>;
  counts: Record<string, number>;
};

const NODE = '.svelte-flow__node[data-id]';
const PLAYER = 'iframe, hyperframes-player, video';
const WATCHED_FETCH = /\/session(\?|$)|preview|poster|fonts\.(googleapis|gstatic)|\.woff2?|\/storage\/v1\/object|\/sign\//;
const IGNORED_FETCH = /posthog|realtime|_app\/immutable|@vite|node_modules|__data\.json|\.svelte|\.ts(\?|$)/;
const FLASH_DELTA = 38;
const SETTLE_DELTA = 14;
const GRID = 6;

function install() {
  const w = window as unknown as { __fluid?: unknown };
  if (w.__fluid) {
    return;
  }
  const nodeSel = '.svelte-flow__node[data-id]';
  const playerSel = 'iframe, hyperframes-player, video';
  let on = false;
  let removed: string[] = [];
  let mounts: string[] = [];
  let frames: number[] = [];
  let latencies: number[] = [];
  let longTasks: number[] = [];
  let pending: number[] = [];
  let watches: { id: string; selector: string; read: string }[] = [];
  let sequences: Record<string, string[]> = {};
  let countsAtStart: Record<string, number> = {};
  let last = 0;

  const idsIn = (n: Node): string[] => {
    if (!(n instanceof Element)) {
      return [];
    }
    const own = n.matches(nodeSel) ? [(n as HTMLElement).dataset.id!] : [];
    return [...own, ...[...n.querySelectorAll<HTMLElement>(nodeSel)].map((e) => e.dataset.id!)];
  };

  const hasPlayer = (n: Node) => n instanceof Element && (n.matches(playerSel) || !!n.querySelector(playerSel));

  new MutationObserver((records) => {
    if (!on) {
      return;
    }
    for (const r of records) {
      for (const n of r.removedNodes) {
        removed.push(...idsIn(n));
        const owner = (r.target as Element).closest?.(nodeSel) as HTMLElement | null;
        if (owner && hasPlayer(n)) {
          removed.push(`${owner.dataset.id}#player`);
        }
      }
      for (const n of r.addedNodes) {
        const owner = (r.target as Element).closest?.(nodeSel) as HTMLElement | null;
        if (owner && hasPlayer(n)) {
          mounts.push(owner.dataset.id!);
        }
      }
    }
  }).observe(document.body, { subtree: true, childList: true });

  const read = (w: { selector: string; read: string }) => {
    const el = document.querySelector<HTMLElement>(w.selector);
    if (!el) {
      return '∅';
    }
    if (w.read === 'box') {
      const r = el.getBoundingClientRect();
      return el.getAttribute('data-box') ?? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
    }
    if (w.read === 'value') {
      return (el as HTMLInputElement).value ?? '∅';
    }
    return el.textContent ?? '∅';
  };

  const tick = (t: number) => {
    if (on) {
      if (last) {
        frames.push(t - last);
      }
      last = t;
      for (const w of watches) {
        const seq = (sequences[w.id] ??= []);
        const v = read(w);
        if (seq.at(-1) !== v) {
          seq.push(v);
        }
      }
      const done = pending;
      pending = [];
      if (done.length) {
        setTimeout(() => {
          const painted = performance.now();
          for (const s of done) {
            latencies.push(painted - s);
          }
        }, 0);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown', 'input', 'wheel']) {
    addEventListener(type, (e) => on && pending.push(e.timeStamp), { capture: true, passive: true });
  }

  try {
    new PerformanceObserver((list) => {
      if (on) {
        longTasks.push(...list.getEntries().map((e) => e.duration));
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    longTasks = [];
  }

  try {
    new PerformanceObserver((list) => {
      if (on) {
        for (const e of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
          if (e.interactionId) {
            latencies.push(e.duration);
          }
        }
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit);
  } catch {
    latencies = [];
  }

  const gpuCounts = () => ({ ...((window as unknown as { __gpuCanvas?: { counts?: Record<string, number> } }).__gpuCanvas?.counts ?? {}) });

  w.__fluid = {
    start(next: { id: string; selector: string; read: string }[]) {
      removed = [];
      mounts = [];
      frames = [];
      latencies = [];
      longTasks = [];
      pending = [];
      sequences = {};
      watches = next;
      last = 0;
      countsAtStart = gpuCounts();
      on = true;
    },
    add(more: { id: string; selector: string; read: string }[]) {
      watches = [...watches, ...more];
    },
    stop() {
      on = false;
      const now = gpuCounts();
      const counts = Object.fromEntries(Object.keys(now).map((k) => [k, now[k] - (countsAtStart[k] ?? 0)]).filter(([, v]) => v));
      return { removed, playerMounts: mounts, frameDeltas: frames, latencies, longTasks, sequences, counts };
    },
    boxes(sel: string) {
      return [...document.querySelectorAll<HTMLElement>(sel)].map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.dataset.id!, x: r.x, y: r.y, width: r.width, height: r.height };
      });
    }
  };
}

const p95 = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : null);

export function reverted(seq: string[]): string | null {
  for (let i = 2; i < seq.length; i++) {
    const back = seq.slice(0, i - 1).lastIndexOf(seq[i]);
    if (back >= 0 && seq[i] !== '∅' && seq[i - 1] !== '∅') {
      return `${seq[i - 1]} → ${seq[i]} (seen before)`;
    }
  }
  return null;
}

type Shot = { data: Buffer; scale: number; offsetTop: number };
type Raw = { pixels: Buffer; width: number; height: number; channels: number; scale: number };

function grid(shot: Raw, box: Box): number[] | null {
  const left = Math.max(0, Math.round((box.x + box.width * 0.2) * shot.scale));
  const top = Math.max(0, Math.round((box.y + box.height * 0.2) * shot.scale));
  const right = Math.min(shot.width, left + Math.round(box.width * 0.6 * shot.scale));
  const bottom = Math.min(shot.height, top + Math.round(box.height * 0.6 * shot.scale));
  if (right - left < GRID || bottom - top < GRID) {
    return null;
  }
  const cells: number[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = Math.floor(left + ((gx + 0.5) * (right - left)) / GRID);
      const y = Math.floor(top + ((gy + 0.5) * (bottom - top)) / GRID);
      const i = (y * shot.width + x) * shot.channels;
      cells.push(shot.pixels[i], shot.pixels[i + 1], shot.pixels[i + 2]);
    }
  }
  return cells;
}

const distance = (a: number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / a.length;
};

export function flashesIn(shots: Raw[], watches: PixelWatch[]): { flashes: string[]; colours: Record<string, number[][]> } {
  const flashes: string[] = [];
  const colours: Record<string, number[][]> = {};
  for (const w of watches) {
    const cells: number[][] = [];
    for (const s of shots) {
      const g = grid(s, w.box);
      if (g) {
        cells.push(g);
      }
    }
    colours[w.id] = cells;
    for (let i = 1; i + 1 < cells.length; i++) {
      const spike = distance(cells[i - 1], cells[i]) > FLASH_DELTA && distance(cells[i], cells[i + 1]) > FLASH_DELTA && distance(cells[i - 1], cells[i + 1]) < SETTLE_DELTA;
      const twoFrame = i + 2 < cells.length && distance(cells[i - 1], cells[i]) > FLASH_DELTA && distance(cells[i - 1], cells[i + 2]) < SETTLE_DELTA && distance(cells[i + 1], cells[i + 2]) > FLASH_DELTA;
      if (spike || twoFrame) {
        flashes.push(`${w.id}${w.touched ? '' : ' (untouched)'} @frame ${i}`);
        i += 2;
      }
    }
  }
  return { flashes, colours };
}

export class FluidProbe {
  private cdp: CDPSession | null = null;
  private shots: Shot[] = [];
  private fetches: string[] = [];
  private recording = false;
  private watchFetch = (r: { url: () => string }) => {
    const url = r.url();
    if (this.recording && WATCHED_FETCH.test(url) && !IGNORED_FETCH.test(url)) {
      this.fetches.push(url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90));
    }
  };

  constructor(private page: Page) {}

  async attach() {
    await this.page.evaluate(install);
    this.page.on('request', this.watchFetch);
    if (this.page.context().browser()?.browserType().name() !== 'chromium') {
      return;
    }
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { deviceWidth: number; offsetTop: number; pageScaleFactor: number } }) => {
      if (this.recording) {
        const data = Buffer.from(f.data, 'base64');
        this.shots.push({ data, scale: 1, offsetTop: f.metadata.offsetTop });
      }
      void this.cdp!.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
    });
  }

  get pixels() {
    return !!this.cdp;
  }

  async nodeBoxes(): Promise<(Box & { id: string })[]> {
    return this.page.evaluate((sel) => (window as unknown as { __fluid: { boxes: (s: string) => (Box & { id: string })[] } }).__fluid.boxes(sel), NODE);
  }

  async start(watches: Watch[]) {
    this.shots = [];
    this.fetches = [];
    this.recording = true;
    await this.page.evaluate((w) => (window as unknown as { __fluid: { start: (w: unknown) => void } }).__fluid.start(w), watches);
    if (this.cdp) {
      const vp = this.page.viewportSize()!;
      await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
    }
  }

  async watch(watches: Watch[]) {
    await this.page.evaluate((w) => (window as unknown as { __fluid: { add: (w: unknown) => void } }).__fluid.add(w), watches);
  }

  async stop(touched: Set<string>, pixelWatches: PixelWatch[]): Promise<{ facts: StepFacts; colours: Record<string, number[][]> }> {
    if (this.cdp) {
      await this.cdp.send('Page.stopScreencast');
    }
    this.recording = false;
    const r = (await this.page.evaluate(() => (window as unknown as { __fluid: { stop: () => unknown } }).__fluid.stop())) as PageResult;
    const present = new Set((await this.nodeBoxes()).map((b) => b.id));
    const remounts = [...new Set(r.removed.filter((id) => present.has(id.replace('#player', '')) && !touched.has(id.replace('#player', ''))))];
    const sharpShots = await this.normalise();
    const { flashes, colours } = this.cdp ? flashesIn(sharpShots, pixelWatches) : { flashes: [], colours: {} };
    const reverts = Object.entries(r.sequences).flatMap(([id, seq]) => {
      const back = reverted(seq);
      return back ? [`${id}: ${back}`] : [];
    });
    const latencies = r.latencies.filter((x) => x >= 0 && x < 5000);
    return {
      facts: {
        remounts,
        playerMounts: [...new Set(r.playerMounts.filter((id) => !touched.has(id)))],
        gpuCounts: r.counts,
        fetches: this.fetches,
        flashes: this.cdp ? flashes : ['unmeasured (no screencast on this engine)'],
        reverts,
        latencyP95: p95(latencies),
        latencyMax: latencies.length ? Math.max(...latencies) : null,
        inputs: latencies.length,
        frameP95: p95(r.frameDeltas),
        frames: r.frameDeltas.length,
        longTasks: r.longTasks.length,
        longTaskMax: r.longTasks.length ? Math.max(...r.longTasks) : 0,
        pixelFrames: this.shots.length
      },
      colours
    };
  }

  private async normalise(): Promise<Raw[]> {
    const vp = this.page.viewportSize()!;
    return Promise.all(
      this.shots.map(async (s) => {
        const { data, info } = await sharp(s.data).raw().toBuffer({ resolveWithObject: true });
        return { pixels: data, width: info.width, height: info.height, channels: info.channels, scale: info.width / vp.width };
      })
    );
  }
}

export { NODE, PLAYER };
