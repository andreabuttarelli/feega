<script module lang="ts">
  const shared = $state<{ playing: string | null }>({ playing: null });
  let nextId = 0;
</script>

<script lang="ts">
  import { PreviewCue, PreviewInput, playingAfter } from './preview-play';

  let { poster, preview, width, height }: { poster: string | null; preview: string | null; width: number; height: number } = $props();

  const IN_VIEW = 0.6;
  const id = `preview-${nextId++}`;

  let host = $state<HTMLElement | null>(null);
  let input = $state(PreviewInput.Hover);
  const playing = $derived(Boolean(preview) && shared.playing === id);

  function cue(next: PreviewCue) {
    shared.playing = playingAfter(shared.playing, id, next, input);
  }

  $effect(() => {
    input = matchMedia('(hover: none)').matches ? PreviewInput.Touch : PreviewInput.Hover;
    if (!host || !preview || input !== PreviewInput.Touch) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => cue(entry.intersectionRatio >= IN_VIEW ? PreviewCue.InView : PreviewCue.OutOfView), { threshold: [0, IN_VIEW] });
    observer.observe(host);
    return () => {
      observer.disconnect();
      cue(PreviewCue.OutOfView);
    };
  });
</script>

<span bind:this={host} class="preview-card" role="presentation" onpointerenter={() => cue(PreviewCue.Enter)} onpointerleave={() => cue(PreviewCue.Leave)}>
  {#if poster}
    <img src={poster} alt="" loading="lazy" decoding="async" {width} {height} />
  {:else}
    <span class="empty">No preview yet</span>
  {/if}
  {#if playing}
    <video src={preview} poster={poster ?? undefined} muted playsinline autoplay loop preload="none" {width} {height}></video>
  {/if}
</span>

<style>
  .preview-card {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    background: #000;
  }

  img,
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 12px;
    color: rgb(255 255 255 / 0.5);
  }
</style>
