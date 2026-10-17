import { Texture } from 'pixi8';
import { Backend } from '../../canvas/gpu/backend';
import { FrameFormat, Layering, Settle } from '../hyperframes/capture';
import { mountCapturePlayer, type CapturePlayer } from '../hyperframes/capture-player';
import { frameOf } from '../export/webgl-device';
import { IDENTITY_3D } from './matrix';
import { PaintKind } from './paint-of';
import { createRenderer, SlotKind, type Slot } from './renderer';
import { gpuEligible, runHtml, runsOf, type Run } from './runs';
import { webglPerLane } from '../export/webgl-budget';
import { compileScene, frameAt, type Drawn, type Scene } from './scene';
import { createPainter } from './textures';

export enum Freshness {
  Exact = 'exact',
  Latest = 'latest'
}

export type FrameStats = { evaluate: number; prepare: number; capture: number; draw: number; captures: number };

export type GpuEngine = { canvas: HTMLCanvasElement; backend: string; scene: Scene; runs: Run[]; renderAt: (t: number, freshness: Freshness) => Promise<FrameStats>; dispose: () => void };

export class GpuIneligible extends Error {
  constructor(runs: number, perRun: number) {
    super(`${runs} HTML runs x ${perRun} WebGL contexts exceed the budget`);
  }
}

const CAPTURE_WAIT_MS = 600_000;

type RunState = { run: Run; html: string; player: Promise<CapturePlayer> | null; texture: Texture | null; at: number; busy: Promise<void> | null };

export async function gpuEngine(html: string, host: HTMLElement, preference: Backend = Backend.WebGPU): Promise<GpuEngine> {
  const scene = compileScene(html);
  if (!gpuEligible(runsOf(scene.layers), webglPerLane(html))) {
    throw new GpuIneligible(runsOf(scene.layers).length, webglPerLane(html));
  }
  const frame = { width: scene.width, height: scene.height };
  const renderer = await createRenderer(frame, preference);
  const painter = createPainter();
  const runs = runsOf(scene.layers);
  const painted = scene.layers.map((l) => l.clip);
  const states: RunState[] = runs.map((run) => ({ run, html: runHtml(html, run, painted), player: null, texture: null, at: Number.NaN, busy: null }));
  const runOf = new Map(runs.flatMap((run, i) => run.clips.map((clip) => [clip, i] as const)));
  const request = { format: FrameFormat.Bitmap, settle: Settle.Seek, layering: Layering.Flat, ...frame };

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
    await painter.prepare(items, t);
    const t2 = performance.now();
    const visible = new Set(items.map((d) => runOf.get(d.clip)).filter((r): r is number => r !== undefined));
    const waits = [...visible].map((i) => ensureRun(states[i], t, freshness)).filter(Boolean);
    await Promise.all(waits);
    const t3 = performance.now();
    renderer.draw(slotsOf(items));
    const t4 = performance.now();
    return { evaluate: t1 - t0, prepare: t2 - t1, capture: t3 - t2, draw: t4 - t3, captures: waits.length };
  };

  const dispose = () => {
    renderer.destroy();
    states.forEach((s) => void s.player?.then((p) => p.dispose()));
  };

  return { canvas: renderer.canvas, backend: renderer.backend, scene, runs, renderAt, dispose };
}
