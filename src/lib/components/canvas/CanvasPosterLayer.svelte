<script lang="ts">
  import { useNodes, useStore } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { LOD_CLASS, LOD_SETTLE_MS, lodWanted, oncePerUrl, posterRects, PosterSource, THUMB_WIDTH, type PlacedNode, type Poster } from '$lib/canvas/poster-lod';

  let { posters }: { posters: Map<string, Poster> } = $props();

  const PLACEHOLDER = '#000';

  const store = useStore();
  const nodesStore = useNodes();
  const thumbs = new Map<string, HTMLCanvasElement>();
  let ready = $state(0);
  let canvas: HTMLCanvasElement;
  let frame = 0;
  let painted = false;

  let active = $state(false);
  let settle: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const wanted = lodWanted(store.viewport.zoom);
    clearTimeout(settle);
    if (wanted === active) {
      return;
    }
    settle = setTimeout(() => (active = wanted), LOD_SETTLE_MS);
  });

  $effect(() => {
    canvas.closest('.svelte-flow')?.classList.toggle(LOD_CLASS, active);
  });

  const VIDEO_FRAME_S = 0.1;

  function shrink(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
    const thumb = document.createElement('canvas');
    thumb.width = THUMB_WIDTH;
    thumb.height = Math.max(1, Math.round((THUMB_WIDTH * height) / width));
    thumb.getContext('2d')!.drawImage(source, 0, 0, thumb.width, thumb.height);
    return thumb;
  }

  async function imageThumb(url: string): Promise<HTMLCanvasElement> {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return shrink(image, image.naturalWidth, image.naturalHeight);
  }

  async function videoThumb(url: string): Promise<HTMLCanvasElement> {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = url;
    const seeked = new Promise((resolve, reject) => {
      video.addEventListener('seeked', resolve, { once: true });
      video.addEventListener('error', reject, { once: true });
    });
    video.addEventListener('loadedmetadata', () => (video.currentTime = Math.min(VIDEO_FRAME_S, video.duration / 2)), { once: true });
    await seeked;
    const thumb = shrink(video, video.videoWidth, video.videoHeight);
    video.removeAttribute('src');
    video.load();
    return thumb;
  }

  const DECODES_AT_ONCE = { image: 8, video: 2 };

  const THUMB_OF: Record<PosterSource, (url: string) => Promise<HTMLCanvasElement>> = {
    [PosterSource.Image]: oncePerUrl(imageThumb, DECODES_AT_ONCE.image),
    [PosterSource.VideoFrame]: oncePerUrl(videoThumb, DECODES_AT_ONCE.video)
  };

  function placed(): PlacedNode[] {
    return nodesStore.current.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      w: node.measured?.width ?? node.width ?? 0,
      h: node.measured?.height ?? node.height ?? 0
    }));
  }

  function draw() {
    frame = 0;
    const dpr = devicePixelRatio;
    const width = store.width;
    const height = store.height;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const context = canvas.getContext('2d')!;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const rects = active ? posterRects(placed(), store.viewport, { width, height }, new Set(posters.keys())) : [];
    context.fillStyle = PLACEHOLDER;
    for (const rect of rects) {
      const thumb = thumbs.get(rect.id);
      if (thumb) {
        context.drawImage(thumb, rect.x, rect.y, rect.w, rect.h);
        continue;
      }
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    painted = rects.length > 0;
  }

  function schedule() {
    if (!frame && canvas) {
      frame = requestAnimationFrame(draw);
    }
  }

  $effect(() => {
    for (const [id, poster] of posters) {
      if (thumbs.has(id)) {
        continue;
      }
      THUMB_OF[poster.source](poster.url)
        .then((thumb) => {
          thumbs.set(id, thumb);
          ready += 1;
        })
        .catch(() => {});
    }
  });

  $effect(() => {
    void store.viewport;
    void store.width;
    void store.height;
    void nodesStore.current;
    void ready;
    if (active || painted) {
      schedule();
    }
  });

  onMount(() => () => {
    cancelAnimationFrame(frame);
    clearTimeout(settle);
  });
</script>

<canvas bind:this={canvas} class="svelte-flow__container posters" data-testid="poster-layer"></canvas>

<style>
  .posters {
    pointer-events: none;
    z-index: 0;
  }
</style>
