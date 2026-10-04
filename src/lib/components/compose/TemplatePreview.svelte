<script lang="ts">
  import type { CompositionScene } from '$lib/canvas/composition/scene';
  import type { LayoutId } from '$lib/canvas/composition/types';
  import { createSceneWhenMounted } from '$lib/canvas/composition-editor';
  import { newDraft } from '$lib/motion/composition-draft';

  let { layout, pictures }: { layout: LayoutId; pictures: string[] } = $props();

  const TILE_SIDE = 256;
  const TILE_COUNT = 6;
  const TILE_HUES = [18, 42, 200, 160, 280, 340];

  let canvas = $state<HTMLCanvasElement | null>(null);
  let visible = $state(false);

  function tiles(): string[] {
    return Array.from({ length: TILE_COUNT }, (_, i) => {
      const tile = document.createElement('canvas');
      tile.width = TILE_SIDE;
      tile.height = TILE_SIDE;
      const ctx = tile.getContext('2d');
      if (!ctx) {
        return '';
      }
      const hue = TILE_HUES[i % TILE_HUES.length];
      const fill = ctx.createLinearGradient(0, 0, TILE_SIDE, TILE_SIDE);
      fill.addColorStop(0, `hsl(${hue} 55% 62%)`);
      fill.addColorStop(1, `hsl(${hue + 30} 50% 28%)`);
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, TILE_SIDE, TILE_SIDE);
      return tile.toDataURL('image/png');
    });
  }

  $effect(() => {
    if (!canvas) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!canvas || !visible) {
      return;
    }
    const target = canvas;
    const draft = newDraft(layout);
    const media = (pictures.length ? pictures : tiles()).map((url) => ({ url, kind: 'image' as const, aspect: 1 }));
    let scene: CompositionScene | null = null;
    let frame = 0;
    let stopped = false;

    void createSceneWhenMounted(
      target,
      () => !stopped && canvas === target,
      async () => {
        const { createCompositionScene } = await import('$lib/canvas/composition/scene');
        return (el) =>
          createCompositionScene(el, {
            media,
            layout,
            layoutParams: draft.layoutParams,
            camera: draft.camera,
            cameraParams: draft.cameraParams,
            background: draft.background,
            duration: draft.seconds
          });
      }
    ).then((made) => {
      if (!made) {
        return;
      }
      scene = made;
      scene.resize(target.clientWidth, target.clientHeight);
      const startedAt = performance.now();
      const render = (now: number) => {
        scene?.renderAt(((now - startedAt) / 1000) % draft.seconds);
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      scene?.dispose();
      scene = null;
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    background: #000;
  }
</style>
