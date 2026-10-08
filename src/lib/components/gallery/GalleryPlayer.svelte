<script lang="ts">
  import { onMount } from 'svelte';
  import CompositionPlayer from '$lib/components/motion/CompositionPlayer.svelte';
  import { FORMATS, type MotionDoc, type MotionFormat } from '$lib/motion/doc';
  import { Playback } from '$lib/gallery/model';

  type Source = { doc: MotionDoc; assets: Record<string, string> };

  let {
    id,
    format,
    posterUrl,
    previewUrl,
    source = null,
    playback = Playback.OnHover,
    hovered = false
  }: { id: string; format: MotionFormat; posterUrl: string | null; previewUrl: string | null; source?: Source | null; playback?: Playback; hovered?: boolean } = $props();

  const VISIBLE_MARGIN = '200px';
  const REST_SHARE = 0.4;

  let box = $state<HTMLDivElement | null>(null);
  let video = $state<HTMLVideoElement | null>(null);
  let visible = $state(false);
  let canHover = $state(true);
  let loaded = $state<Source | null>(null);

  const live = $derived(source ?? loaded);
  const ratio = $derived(`${FORMATS[format].width} / ${FORMATS[format].height}`);
  const playing = $derived(visible && (playback === Playback.Always || !canHover || hovered));
  const restFrame = $derived(live ? Math.round(live.doc.durationInFrames * REST_SHARE) : 0);

  $effect(() => {
    if (!video) {
      return;
    }
    if (playing) {
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  });

  async function fetchSource() {
    if (live || previewUrl) {
      return;
    }
    const res = await fetch(`/gallery/${id}/doc`).catch(() => null);
    loaded = res?.ok ? ((await res.json()) as Source) : null;
  }

  onMount(() => {
    canHover = window.matchMedia('(hover: hover)').matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          void fetchSource();
        }
      },
      { rootMargin: VISIBLE_MARGIN }
    );
    if (box) {
      observer.observe(box);
    }
    return () => observer.disconnect();
  });
</script>

<div class="player" bind:this={box} style={`aspect-ratio: ${ratio};`} data-testid="gallery-player" data-playing={playing}>
  {#if previewUrl}
    <video bind:this={video} class="media" src={visible ? previewUrl : undefined} poster={posterUrl ?? undefined} muted loop playsinline preload="metadata"></video>
  {:else if posterUrl && !playing}
    <img class="media" src={posterUrl} alt="" loading="lazy" />
  {:else if visible && live}
    <div class="media"><CompositionPlayer doc={live.doc} assets={live.assets} active={playing} {restFrame} /></div>
  {/if}
</div>

<style>
  .player {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: var(--ui-surface);
  }

  .media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
