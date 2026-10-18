import { Texture } from 'pixi8';
import { Backend } from '../../canvas/gpu/backend';
import { FrameFormat, Settle } from '../hyperframes/capture';
import { mountCapturePlayer, type CapturePlayer } from '../hyperframes/capture-player';
import { exportLayering, frameOf } from '../export/webgl-device';
import { IDENTITY_3D } from './matrix';
import { PaintKind } from './paint-of';
import { createRenderer, SlotKind, type Slot } from './renderer';
import { gpuEligible, runHtml, runsOf, type Run } from './runs';
import { lanesWithin, webglPerLane } from '../export/webgl-budget';
import { shootInLanes } from '../export/lanes';
import { withDeadline } from '../export/deadline';
import { compileScene, frameAt, visibleAt, type Drawn, type Scene } from './scene';
import { createPainter } from './textures';
import { layoutText } from './text-layout';
import { mountCanvasHost, type CanvasHost } from './canvas-host';

export enum Freshness {
  Exact = 'exact',
  Latest = 'latest'
}

export type FrameStats = { evaluate: number; prepare: number; capture: number; draw: number; captures: number };

export type GpuEngine = { canvas: HTMLCanvasElement; backend: string; scene: Scene; runs: Run[]; renderAt: (t: number, freshness: Freshness) => Promise<FrameStats>; renderFrames: (times: number[], onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>, lanes: number, signal: AbortSignal) => Promise<void>; dispose: () => void };

export class GpuIneligible extends Error {
  constructor(runs: number, perRun: number) {
    super(`HTML captures (${runs} runs, up to ${perRun} WebGL contexts each) would cost more than the HTML engine`);
  }
}

const CAPTURE_WAIT_MS = 600_000;
const FRAME_DEADLINE_MS = 60_000;

type RunState = { run: Run; html: string; player: Promise<CapturePlayer> | null; texture: Texture | null; at: number; busy: Promise<void> | null };

export type Compose = (only?: ReadonlySet<string>) => string;

export async function gpuEngine(compose: Compose, host: HTMLElement, preference: Backend = Backend.WebGPU): Promise<GpuEngine> {
  const scene = compileScene(compose());
  const runs = runsOf(scene.layers);
  const pages = runs.map((run) => runHtml(compose(new Set(run.clips)), run));
  const contexts = pages.map(webglPerLane);
  if (!gpuEligible(runs, contexts, scene.duration)) {
    throw new GpuIneligible(runs.length, Math.max(0, ...contexts));
  }
  const frame = { width: scene.width, height: scene.height };
  const renderer = await createRenderer(frame, preference);
  const painter = createPainter();
  painter.texts(await layoutText(scene, host));
  const canvasClips = scene.layers.filter((l) => l.paint.kind === PaintKind.Canvas).flatMap((l) => l.covers);
  const canvasHost: CanvasHost | null = canvasClips.length ? await mountCanvasHost(host, runHtml(compose(new Set(canvasClips)), { clips: canvasClips, after: 0, blend: 'normal', span: [0, scene.duration] }), frame) : null;
  if (canvasHost) {
    painter.canvases(canvasHost.canvas);
  }
  const states: RunState[] = runs.map((run, i) => ({ run, html: pages[i], player: null, texture: null, at: Number.NaN, busy: null }));
  const runOf = new Map(runs.flatMap((run, i) => run.clips.map((clip) => [clip, i] as const)));
  const request = { format: FrameFormat.Bitmap, settle: Settle.Seek, layering: exportLayering(), ...frame };

  const capture = (state: RunState, t: number) => {
    state.player ??= mountCapturePlayer(host, state.html);
    const job = state.player
      .then((p) => p.shoot(t, request, CAPTURE_WAIT_MS))
      .then((reply) => {
        const old = state.texture;
        state.texture = Texture.from(frameOf(reply));
        state.at = t;
        old?.destroy(true);
      })
      .finally(() => {
        state.busy = null;
      });
    state.busy = job;
    return job;
  };

  const ensureRun = (state: RunState, t: number, freshness: Freshness): Promise<void> | null => {
    if (state.at === t) {
      return null;
    }
    if (freshness === Freshness.Exact) {
      return (state.busy ?? Promise.resolve()).then(() => (state.at === t ? undefined : capture(state, t)));
    }
    if (!state.busy) {
      void capture(state, t);
    }
    return state.texture ? null : state.busy;
  };

  const background = (): Slot[] => {
    if (!scene.background || scene.background === 'transparent') {
      return [];
    }
    const quad = [[0, 0], [frame.width, 0], [frame.width, frame.height], [0, frame.height]] as Drawn['quad'];
    const drawn: Drawn = { clip: '', layer: null as never, paint: { kind: PaintKind.Fill, color: scene.background, pattern: '' }, quad, matrix: IDENTITY_3D, opacity: 1, blur: 0, blend: 'normal', clips: [], content: frame, focus: [0.5, 0.5] };
    return [{ kind: SlotKind.Native, drawn, placement: { texture: painter.fill(scene.background, frame), rect: [0, 0, frame.width, frame.height] } }];
  };

  const slotsOf = (items: Drawn[]): Slot[] => {
    const slots = background();
    const emitted = new Set<number>();
    for (const d of items) {
      const run = runOf.get(d.clip);
      if (d.paint.kind === PaintKind.Html && run !== undefined) {
        const texture = states[run].texture;
        if (!emitted.has(run) && texture) {
          slots.push({ kind: SlotKind.Run, texture, blend: states[run].run.blend });
        }
        emitted.add(run);
        continue;
      }
      const placement = painter.place(d);
      if (placement) {
        slots.push({ kind: SlotKind.Native, drawn: d, placement });
      }
    }
    return slots;
  };

  const renderAt = async (t: number, freshness: Freshness): Promise<FrameStats> => {
    const t0 = performance.now();
    const items = frameAt(scene, t);
    const t1 = performance.now();
    canvasHost?.at(t);
    await painter.prepare(items, t);
    const t2 = performance.now();
    const visible = new Set(items.map((d) => runOf.get(d.clip)).filter((r): r is number => r !== undefined));
    states.forEach((state, i) => {
      if (!visible.has(i) && state.player && !state.busy) {
        void state.player.then((p) => p.dispose());
        state.player = null;
        state.at = Number.NaN;
      }
    });
    const waits = [...visible].map((i) => ensureRun(states[i], t, freshness)).filter(Boolean);
    await Promise.all(waits);
    const t3 = performance.now();
    renderer.draw(slotsOf(items));
    const t4 = performance.now();
    return { evaluate: t1 - t0, prepare: t2 - t1, capture: t3 - t2, draw: t4 - t3, captures: waits.length };
  };

  const runsAt = (t: number) => runs.flatMap((run, i) => (scene.layers.some((l) => run.clips.includes(l.clip) && visibleAt(l, t)) ? [i] : []));

  const renderFrames: GpuEngine['renderFrames'] = async (times, onFrame, wanted, signal) => {
    const lanes = lanesWithin(wanted, contexts.reduce((a, b) => a + b, 0));
    const players = Array.from({ length: lanes }, () => new Map<number, Promise<CapturePlayer>>());
    const shooter = (lane: number) => async (t: number) => {
      const shots = await Promise.all(
        runsAt(t).map(async (r) => {
          const player = players[lane].get(r) ?? mountCapturePlayer(host, pages[r]);
          players[lane].set(r, player);
          return [r, frameOf(await (await player).shoot(t, request, CAPTURE_WAIT_MS))] as const;
        })
      );
      return new Map(shots);
    };
    const drawFrame = async (shots: Map<number, ImageBitmap>, index: number) => {
      const t = times[index];
      states.forEach((state, r) => {
        const bitmap = shots.get(r);
        if (bitmap) {
          state.texture?.destroy(true);
          state.texture = Texture.from(bitmap);
          state.at = t;
        }
      });
      const items = frameAt(scene, t);
      canvasHost?.at(t);
      await painter.prepare(items, t);
      renderer.draw(slotsOf(items));
      await onFrame(await createImageBitmap(renderer.canvas), index);
    };
    try {
      await shootInLanes(
        times,
        players.map((_, lane) => shooter(lane)),
        (shots, index) => withDeadline(drawFrame(shots, index), FRAME_DEADLINE_MS, `GPU frame ${index}`),
        signal
      );
    } finally {
      players.forEach((lane) => lane.forEach((p) => void p.then((x) => x.dispose())));
    }
  };

  const dispose = () => {
    renderer.destroy();
    canvasHost?.dispose();
    states.forEach((s) => void s.player?.then((p) => p.dispose()));
  };

  return { canvas: renderer.canvas, backend: renderer.backend, scene, runs, renderAt, renderFrames, dispose };
}
