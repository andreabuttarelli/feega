<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Download from '@lucide/svelte/icons/download';
  import { waveformOf, WAVEFORM_BARS } from '$lib/canvas/waveform';

  let { src, cacheKey, filename = 'audio.mp3' }: { src: string; cacheKey: string; filename?: string } = $props();

  const FLAT_BAR = 0.08;
  const ICON_SIZE = 14;

  let audio = $state<HTMLAudioElement>();
  let playing = $state(false);
  let progress = $state(0);
  let peaks = $state<number[]>(Array(WAVEFORM_BARS).fill(FLAT_BAR));

  $effect(() => {
    const key = cacheKey;
    const url = src;
    waveformOf(key, url)
      .then((found) => {
        peaks = found;
      })
      .catch(() => {});
  });

  function toggle() {
    if (!audio) {
      return;
    }
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  }

  function seek(event: MouseEvent) {
    if (!audio?.duration) {
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    audio.currentTime = ((event.clientX - box.left) / box.width) * audio.duration;
  }

  function track() {
    progress = audio?.duration ? audio.currentTime / audio.duration : 0;
  }
</script>

<div class="player nodrag" data-testid="audio-player">
  <audio
    bind:this={audio}
    {src}
    preload="metadata"
    onplay={() => (playing = true)}
    onpause={() => (playing = false)}
    onended={() => (playing = false)}
    ontimeupdate={track}
  ></audio>

  <button type="button" class="play" aria-label={playing ? 'Pause' : 'Play'} onclick={toggle}>
    {#if playing}<Pause size={ICON_SIZE} />{:else}<Play size={ICON_SIZE} />{/if}
  </button>

  <button type="button" class="wave" aria-label="Seek" onclick={seek}>
    {#each peaks as peak, i (i)}
      <i class:is-played={i / peaks.length < progress} style:height={`${Math.max(peak, FLAT_BAR) * 100}%`}></i>
    {/each}
  </button>

  <a class="download" href={src} download={filename} aria-label="Download audio">
    <Download size={ICON_SIZE} />
  </a>
</div>

<style>
  .player {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    padding: 10px;
    background: var(--paper-2, #f9f9f9);
  }
  .play,
  .download {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 1px solid var(--line-2, #d2d2d7);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: pointer;
    padding: 0;
  }
  .wave {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 56px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }
  .wave i {
    flex: 1;
    min-height: 2px;
    background: var(--line-2, #d2d2d7);
  }
  .wave i.is-played {
    background: var(--accent, #c485fe);
  }
</style>
