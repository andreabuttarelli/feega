<script lang="ts">
  import type { Preview } from '$lib/motion/template/catalogue';

  let { preview, name, live = false }: { preview: Preview | null; name: string; live?: boolean } = $props();

  let video = $state<HTMLVideoElement | null>(null);
  let seen = $state(false);
  let hovered = $state(false);

  const playing = $derived(live || hovered || seen);

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

  function watch(node: HTMLElement) {
    const touch = matchMedia('(hover: none)').matches;
    if (!touch) {
      return;
    }
    const observer = new IntersectionObserver(([e]) => (seen = e.isIntersecting), { threshold: 0.6 });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
</script>

<span class="preview" role="presentation" use:watch onpointerenter={() => (hovered = true)} onpointerleave={() => (hovered = false)}>
  {#if preview}
    <img src={preview.poster} alt="" loading="lazy" decoding="async" />
    {#if playing && preview.video}<video bind:this={video} src={preview.video} poster={preview.poster} muted loop playsinline preload="none" aria-label={name}></video>{/if}
  {:else}
    <span class="blank">{name}</span>
  {/if}
</span>

<style>
  .preview {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--ui-surface);
  }

  img,
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #0a0a0a;
  }

  .blank {
    display: grid;
    place-items: center;
    height: 100%;
    padding: 8px;
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
    text-align: center;
  }
</style>
