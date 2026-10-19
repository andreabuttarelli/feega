<script lang="ts">
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { drawFrame, prepare, type DisplayList } from '$lib/motion/gpu-full/display-list';
  import { smoothingOf } from '$lib/motion/gpu-full/text/painter';
  import { loadFonts } from '$lib/motion/gpu-full/text/load';
  import type { Raster, Staging } from '$lib/motion/gpu-full/raster';
  import { Restage, cameraFrom, restageFor } from '$lib/canvas/core/stage-camera';
  import { BACKENDS, FullBackend } from '$lib/motion/gpu-full/backends';
  import { createMedia } from '$lib/motion/gpu-full/media';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { visibleIds } from '$lib/canvas/gpu/camera';
  import { canvasScene, type FrameOnCanvas, type SceneLook } from '$lib/canvas/core/canvas-scene';
  import { drawsWhole, stillFrame, type FrameAt } from '$lib/canvas/core/frame-source';

  type Source = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens };

  let { frames, view, area, sourceUrl, onready, onfallback }: { frames: FrameAt[]; view: Viewport; area: { width: number; height: number }; sourceUrl: (id: string) => string; onready: (ids: Set<string>) => void; onfallback: (why: string) => void } = $props();

  const MAX_RESOLUTION = 2;
  const IDLE_RESTAGE_MS = 160;
  const LOOK: SceneLook = { background: [0, 0, 0, 0], selection: [0, 0, 0, 0], selectionWidth: 0 };
  const ORDER = [FullBackend.Core];

  let canvas = $state<HTMLCanvasElement | null>(null);
  let lists = $state(new Map<string, DisplayList>());
  const asked = new Set<string>();
  const keyOf = (f: FrameAt) => `${f.id}:${f.revision}`;
  const resolution = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_RESOLUTION);

  async function load(f: FrameAt) {
    const res = await fetch(`${sourceUrl(f.id)}?revision=${f.revision}`);
    if (!res.ok) {
      return;
    }
    const source = (await res.json()) as Source;
    const fonts = await loadFonts(source.doc, source.assets);
    const prepared = prepare(source.doc, source.tokens, source.assets, { fonts, smoothing: smoothingOf(navigator.userAgent) });
    lists = new Map(lists).set(keyOf(f), drawFrame(prepared, stillFrame(source.doc)));
  }

  $effect(() => {
    const seen = visibleIds(frames.map((f) => ({ id: f.id, ...f.box })), view, area);
    for (const f of frames) {
      if (seen.has(f.id) && !asked.has(keyOf(f))) {
        asked.add(keyOf(f));
        void load(f).catch((e: unknown) => console.warn('[canvas] core frame not loaded', f.id, e));
      }
    }
  });

  const placed = $derived(frames.flatMap((f): FrameOnCanvas[] => (lists.has(keyOf(f)) && drawsWhole(lists.get(keyOf(f))!) ? [{ id: f.id, box: f.box, list: lists.get(keyOf(f))! }] : [])));

  $effect(() => {
    onready(new Set(placed.map((f) => f.id)));
  });

  let raster = $state<Raster | null>(null);

  $effect(() => {
    const target = canvas;
    const width = Math.round(area.width * resolution);
    const height = Math.round(area.height * resolution);
    if (!target || !width || !height) {
      return;
    }
    target.width = width;
    target.height = height;
    let gone = false;
    let made: Raster | null = null;
    const attempt = (i: number): Promise<void> =>
      BACKENDS[ORDER[i]](target, width, height).then(
        (r) => {
          made = r;
          if (gone) {
            r.dispose();
            return;
          }
          raster = r;
        },
        (e: unknown) => (i + 1 < ORDER.length ? attempt(i + 1) : onfallback(e instanceof Error ? e.message : String(e)))
      );
    void attempt(0);
    return () => {
      gone = true;
      raster = null;
      made?.dispose();
    };
  });

  const media = createMedia();
  let pending = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let staged: { view: Viewport; frames: FrameOnCanvas[]; raster: Raster } | null = null;

  const screenOf = () => ({ width: area.width * resolution, height: area.height * resolution });
  const scaled = (v: Viewport): Viewport => ({ x: v.x * resolution, y: v.y * resolution, zoom: v.zoom * resolution });
  const reach = () => Math.max(area.width, area.height) * resolution;

  function stage(into: Raster, staging: Staging, at: Viewport, frames: FrameOnCanvas[]) {
    const scene = canvasScene(frames, scaled(at), screenOf(), new Set(), LOOK, reach());
    staged = { view: at, frames, raster: into };
    void media.ready(scene).then(() => {
      staging.stage(scene, media.pictures);
      staging.show(cameraFrom(at, view, resolution));
    });
  }

  function paint(into: Raster, at: Viewport, frames: FrameOnCanvas[]) {
    clearTimeout(idle);
    const staging = into.staging;
    if (!staging) {
      const scene = canvasScene(frames, scaled(at), screenOf(), new Set(), LOOK);
      void media.ready(scene).then(() => into.draw(scene, media.pictures));
      return;
    }
    const fresh = !staged || staged.raster !== into || staged.frames !== frames;
    const verdict = fresh ? Restage.Now : restageFor(staged!.view, at, { width: area.width, height: area.height }, reach() / resolution);
    if (verdict === Restage.Now) {
      stage(into, staging, at, frames);
      return;
    }
    staging.show(cameraFrom(staged!.view, at, resolution));
    if (verdict === Restage.WhenIdle) {
      idle = setTimeout(() => stage(into, staging, view, frames), IDLE_RESTAGE_MS);
    }
  }

  $effect(() => {
    const into = raster;
    const at = view;
    const frames = placed;
    cancelAnimationFrame(pending);
    if (!into) {
      return;
    }
    pending = requestAnimationFrame(() => paint(into, at, frames));
  });

  $effect(() => () => {
    clearTimeout(idle);
    media.dispose();
  });
</script>

<canvas class="core-frames" bind:this={canvas} data-testid="core-canvas" data-frames={placed.length} data-partial={[...lists.values()].filter((l) => !drawsWhole(l)).length}></canvas>

<style>
  .core-frames {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
