<script lang="ts">
  import { onMount } from 'svelte';
  import CompositionPlayer from '$lib/components/motion/CompositionPlayer.svelte';
  import { FORMATS, type MotionDoc, type MotionFormat } from '$lib/motion/doc';

  type Source = { doc: MotionDoc; assets: Record<string, string> };

  let {
    id,
    format,
    posterUrl,
    previewUrl,
    source = null,
    eager = false
  }: { id: string; format: MotionFormat; posterUrl: string | null; previewUrl: string | null; source?: Source | null; eager?: boolean } = $props();

  const VISIBLE_MARGIN = '200px';

  let box = $state<HTMLDivElement | null>(null);
  let visible = $state(false);
  let loaded = $state<Source | null>(null);

  const live = $derived(source ?? loaded);
  const ratio = $derived(`${FORMATS[format].width} / ${FORMATS[format].height}`);

  async function fetchSource() {
    if (live || previewUrl) {
      return;
    }
    const res = await fetch(`/gallery/${id}/doc`).catch(() => null);
    loaded = res?.ok ? ((await res.json()) as Source) : null;
  }

  onMount(() => {
    if (eager) {
      visible = true;
      void fetchSource();
      return;
    }
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

<div class="player" bind:this={box} style={`aspect-ratio: ${ratio};`} data-testid="gallery-player">
  {#if posterUrl}<img class="poster" src={posterUrl} alt="" loading="lazy" />{/if}
  {#if visible && previewUrl}
    <video class="media" src={previewUrl} poster={posterUrl ?? undefined} muted loop playsinline autoplay preload="metadata"></video>
  {:else if visible && live}
    <div class="media"><CompositionPlayer doc={live.doc} assets={live.assets} /></div>
  {/if}
</div>

<style>
  .player {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: var(--ui-surface);
  }

  .poster,
  .media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
