<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import { sourceSeconds } from '@feega/motion-core/motion/time-remap';
  import { DEFAULT_TRACK, type Spot } from '@feega/motion-core/motion/tracking/point-tracker';
  import { ApplyMode, applyTrack, type ClipTrack } from '@feega/motion-core/motion/tracking/track-clip';
  import { stillAt } from '$lib/motion/tracking/browser-lumas';
  import { PASS_LABEL, Pass, passRange } from '$lib/motion/tracking/track-pass';
  import { runTrackJob, type TrackWorker } from '$lib/motion/tracking/track-job';

  const SEARCH_FACTOR = 3;
  const FEATURE_MIN = 8;
  const FEATURE_MAX = 200;

  let { doc, clip, frame, assetUrl, onchange }: { doc: MotionDoc; clip: MotionClip; frame: number; assetUrl: (assetId: string) => string; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let open = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let point = $state<Spot | null>(null);
  let pointFrame = $state(0);
  let feature = $state(Math.round(DEFAULT_TRACK.feature * doc.width));
  let busy = $state(false);
  let error = $state('');
  let track = $state<ClipTrack | null>(null);
  let target = $state('');
  let offsetX = $state(0);
  let offsetY = $state(0);
  let drawn = 0;

  const local = $derived(Math.min(Math.max(0, frame - clip.from), clip.durationInFrames - 1));
  const src = $derived(typeof clip.props.assetId === 'string' && clip.props.assetId ? new URL(assetUrl(clip.props.assetId), location.href).href : '');
  const targets = $derived(doc.tracks.flatMap((t) => t.clips).filter((c) => c.id !== clip.id));
  const half = $derived({ x: (feature / doc.width) * 100, y: (feature / doc.height) * 100 });
  const reach = $derived({ x: half.x * SEARCH_FACTOR, y: half.y * SEARCH_FACTOR });

  $effect(() => {
    const at = local;
    const url = src;
    const el = canvas;
    if (!open || !url || !el) {
      return;
    }
    const mine = ++drawn;
    stillAt(url, sourceSeconds(clip, at, doc.fps))
      .then((bitmap) => {
        if (mine !== drawn) {
          bitmap.close();
          return;
        }
        el.width = bitmap.width;
        el.height = bitmap.height;
        el.getContext('2d')?.drawImage(bitmap, 0, 0);
        bitmap.close();
      })
      .catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
  });

  function place(e: MouseEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    point = { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
    pointFrame = local;
    track = null;
    error = '';
  }

  const spawn = (): TrackWorker | null => (typeof Worker === 'function' ? (new Worker(new URL('../../motion/tracking/track.worker.ts', import.meta.url), { type: 'module' }) as unknown as TrackWorker) : null);

  async function run(pass: Pass) {
    if (!point || busy) {
      return;
    }
    busy = true;
    error = '';
    const options = { feature: feature / doc.width, search: (feature * SEARCH_FACTOR) / doc.width };
    const request = { clipId: clip.id, frame: pointFrame, point, range: passRange(pass, pointFrame, clip.durationInFrames - 1), options };
    const out = await runTrackJob({ src, doc, request }, spawn);
    busy = false;
    if (!out.ok) {
      error = out.error;
      return;
    }
    track = out.track;
    error = out.track.lost ? `Lost the point after ${out.track.points.length} frames` : '';
  }

  function attach(mode: ApplyMode) {
    const chosen = mode === ApplyMode.Stabilise ? clip.id : target;
    if (!track || !chosen) {
      error = 'Pick a layer to follow the point';
      return;
    }
    const result = applyTrack(doc, track, { targetClipId: chosen, mode, offset: { x: offsetX, y: offsetY } });
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, mode === ApplyMode.Stabilise ? 'Stabilised the video' : 'Applied the track');
  }
</script>

<details class="track" data-testid="track-panel" bind:open>
  <summary>Track point</summary>
  {#if src}
    <p class="hint">Click the picture to place the point. The frame shown is the playhead.</p>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="stage" style={`aspect-ratio: ${doc.width} / ${doc.height}`} onclick={place} data-testid="track-stage">
      <canvas bind:this={canvas}></canvas>
      {#if point}
        <span class="search" style={`left: ${point.x * 100}%; top: ${point.y * 100}%; width: ${reach.x * 2}%; height: ${reach.y * 2}%;`}></span>
        <span class="feature" data-testid="track-point" style={`left: ${point.x * 100}%; top: ${point.y * 100}%; width: ${half.x * 2}%; height: ${half.y * 2}%;`}></span>
      {/if}
    </div>
    <label class="row">Feature size <input type="range" min={FEATURE_MIN} max={FEATURE_MAX} bind:value={feature} /> <span>{feature}px</span></label>
    <div class="buttons">
      {#each Object.values(Pass) as pass (pass)}
        <button type="button" disabled={!point || busy} data-testid={`track-${pass}`} onclick={() => run(pass)}>{PASS_LABEL[pass]}</button>
      {/each}
    </div>
    {#if busy}<p class="state" data-testid="track-busy">Tracking…</p>{/if}
    {#if track}
      <p class="state" data-testid="track-result">{track.points.length} frames tracked</p>
      <label class="row">Layer <select bind:value={target} data-testid="track-target"><option value="">Choose a layer</option>{#each targets as c (c.id)}<option value={c.id}>{c.component} {c.id}</option>{/each}</select></label>
      <label class="row">Offset <input type="number" bind:value={offsetX} aria-label="Offset x" /> <input type="number" bind:value={offsetY} aria-label="Offset y" /></label>
      <div class="buttons">
        <button type="button" data-testid="track-apply" onclick={() => attach(ApplyMode.Follow)}>Apply to layer</button>
        <button type="button" data-testid="track-stabilise" onclick={() => attach(ApplyMode.Stabilise)}>Stabilise video</button>
      </div>
    {/if}
    {#if error}<p class="error" role="alert" data-testid="track-error">{error}</p>{/if}
  {:else}
    <p class="hint">Pick a video file for this clip first.</p>
  {/if}
</details>

<style>
  .track {
    padding: var(--ui-space-2) var(--ui-space-3) var(--ui-space-3);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
  }

  summary {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    text-transform: uppercase;
    color: var(--ui-ink-2);
    cursor: pointer;
  }

  .hint,
  .state {
    margin: var(--ui-space-1) 0;
    color: var(--ui-ink-2);
  }

  .stage {
    position: relative;
    width: 100%;
    max-width: 360px;
    background: var(--ui-bg);
    border: 1px solid var(--ui-line-strong);
    cursor: crosshair;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .feature,
  .search {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
    box-sizing: border-box;
  }

  .feature {
    border: 1px solid var(--ui-accent, #3b82f6);
  }

  .search {
    border: 1px dashed var(--ui-accent, #3b82f6);
    opacity: 0.6;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    margin-top: var(--ui-space-2);
  }

  .row input[type='number'] {
    width: 5em;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
    margin-top: var(--ui-space-2);
  }

  button {
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  button:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  button:disabled {
    color: var(--ui-ink-3);
  }

  .error {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-ink);
  }
</style>
