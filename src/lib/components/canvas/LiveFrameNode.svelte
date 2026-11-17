<script lang="ts">
  import { FrameMode } from '$lib/canvas/live-budget';
  import { liveUrl, type LiveFrame } from '$lib/canvas/live-frame';

  let { live, mode, origin, poster, onsnapshot }: { live: LiveFrame; mode: FrameMode; origin: string | null; poster: string | null; onsnapshot: () => void } = $props();

  let box = $state(0);
  let mounted = $state(false);
  const scale = $derived(box ? box / live.width : 1);
  const showsLive = $derived(origin !== null && mode === FrameMode.Live);

  $effect(() => {
    if (showsLive) {
      mounted = true;
    }
  });

  $effect(() => {
    if (showsLive && mounted) {
      onsnapshot();
    }
  });
</script>

<div class="live" bind:clientWidth={box} data-testid="live-frame" data-mode={showsLive ? FrameMode.Live : FrameMode.Snapshot} data-route={live.route}>
  {#if mounted && origin}
    <iframe class="page" class:hidden={!showsLive} title={live.route} src={liveUrl(origin, live.route)} style={`width:${live.width}px;height:${100 / scale}%;transform:scale(${scale})`} onload={onsnapshot}></iframe>
  {/if}
  {#if poster && !showsLive}
    <img class="poster" src={poster} alt={live.route} draggable="false" data-testid="live-frame-poster" />
  {/if}
  {#if !origin}
    <span class="badge rounded-full" data-testid="live-frame-offline">Not connected · {live.route}</span>
  {/if}
</div>

<style>
  .live { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff; }
  .page { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; }
  .hidden { visibility: hidden; }
  .poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .badge { position: absolute; left: 8px; bottom: 8px; font-size: 11px; padding: 3px 8px; background: rgba(0, 0, 0, 0.7); color: #fff; }
</style>
