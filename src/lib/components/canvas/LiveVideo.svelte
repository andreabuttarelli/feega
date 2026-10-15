<script lang="ts">
  import { Playback, videoMounted, View } from '$lib/canvas/live-video';
  import { tierBoard } from '$lib/canvas/tier-board.svelte';

  let { src, nodeId, selected = false, controls = false, muted = false, autoplay = false, loop = false }: { src: string; nodeId: string; selected?: boolean; controls?: boolean; muted?: boolean; autoplay?: boolean; loop?: boolean } = $props();

  const board = tierBoard();
  let playback = $state(Playback.Paused);
  let resumeAt = 0;

  const mounted = $derived(
    !board || videoMounted({ view: board.view, onScreen: board.onScreen(nodeId), selected, playback })
  );

  function resume(event: Event) {
    const video = event.currentTarget as HTMLVideoElement;
    if (resumeAt > 0) {
      video.currentTime = resumeAt;
    }
  }

  function remember(event: Event) {
    resumeAt = (event.currentTarget as HTMLVideoElement).currentTime;
  }
</script>

{#if mounted}
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    {src}
    {controls}
    {muted}
    {autoplay}
    {loop}
    playsinline
    preload="metadata"
    data-testid="live-video"
    onloadedmetadata={resume}
    ontimeupdate={remember}
    onplay={() => (playback = Playback.Playing)}
    onpause={() => (playback = Playback.Paused)}
    onended={() => (playback = Playback.Paused)}
  ></video>
{:else}
  <div class="unmounted" data-testid="video-unmounted" data-view={board?.view ?? View.Readable}></div>
{/if}

<style>
  .unmounted {
    width: 100%;
    height: 100%;
    background: var(--paper-2, #f9f9f9);
  }
</style>
