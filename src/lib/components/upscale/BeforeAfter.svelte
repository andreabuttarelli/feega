<script lang="ts">
  let { before, after, poster = undefined, label = 'Before and after upscale' }: { before: string; after: string; poster?: string; label?: string } = $props();

  const SYNC_TOLERANCE_S = 0.04;

  let split = $state(50);
  let beforeEl = $state<HTMLVideoElement | null>(null);
  let afterEl = $state<HTMLVideoElement | null>(null);

  function follow() {
    if (!beforeEl || !afterEl) {
      return;
    }
    if (Math.abs(beforeEl.currentTime - afterEl.currentTime) > SYNC_TOLERANCE_S) {
      beforeEl.currentTime = afterEl.currentTime;
    }
  }
</script>

<figure class="compare" aria-label={label} data-testid="upscale-compare">
  <video bind:this={afterEl} class="layer" src={after} {poster} autoplay muted loop playsinline preload="metadata" ontimeupdate={follow}></video>
  <video bind:this={beforeEl} class="layer before" src={before} {poster} autoplay muted loop playsinline preload="metadata" style:clip-path={`inset(0 ${100 - split}% 0 0)`}></video>
  <span class="tag left">Before</span>
  <span class="tag right">After</span>
  <span class="divider" style:left={`${split}%`}></span>
  <input class="range" type="range" min="0" max="100" bind:value={split} aria-label="Move the divider between before and after" />
</figure>

<style>
  .compare { position: relative; margin: 0; width: 100%; aspect-ratio: 16 / 9; background: #000; overflow: hidden; }
  .layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .divider { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; transform: translateX(-1px); pointer-events: none; }
  .tag { position: absolute; top: 8px; padding: 2px 6px; font-size: 11px; font-weight: 600; background: rgba(0, 0, 0, 0.6); color: #fff; }
  .left { left: 8px; }
  .right { right: 8px; }
  .range { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; }
</style>
