<script lang="ts">
  import GraphEditor from '$lib/components/motion/GraphEditor.svelte';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import MotionTimeline from '$lib/components/motion/MotionTimeline.svelte';
  import TimeRemap from '$lib/components/motion/TimeRemap.svelte';
  import { advance } from '$lib/canvas/frame-playhead';
  import { Action } from '$lib/motion/actions';
  import { findClip, type MotionDoc } from '$lib/motion/doc';
  import { Snap } from '$lib/motion/timeline-view';
  import type { KeyRef } from '$lib/motion/timeline';

  let {
    doc,
    frame,
    selection,
    onframe,
    onselect,
    onchange
  }: { doc: MotionDoc; frame: number; selection: string[]; onframe: (frame: number) => void; onselect: (ids: string[]) => void; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let playing = $state(false);
  let graphOpen = $state(false);
  let camera = $state(false);
  let zoom = $state(1);
  let keySelection = $state<KeyRef[]>([]);
  let raf = 0;
  let last = 0;
  let head = 0;

  const remapped = $derived.by(() => {
    const found = selection.length === 1 ? findClip(doc, selection[0]) : null;
    return found?.clip.component === 'Video' ? found.clip : null;
  });

  function tick(now: number) {
    head = advance({ frame: head, ms: now - last, fps: doc.fps, duration: doc.durationInFrames });
    last = now;
    onframe(head);
    raf = requestAnimationFrame(tick);
  }

  function toggle() {
    playing = !playing;
    cancelAnimationFrame(raf);
    if (!playing) {
      return;
    }
    head = frame;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function scrub(next: number) {
    playing = false;
    cancelAnimationFrame(raf);
    onframe(next);
  }

  $effect(() => () => cancelAnimationFrame(raf));
</script>

<section class="timeline" data-testid="frame-timeline">
  <div class="bar">
    <IconButton action={playing ? Action.Pause : Action.Play} class="play" fill="currentColor" data-testid="frame-timeline-play" onclick={toggle} />
    <span class="time" data-testid="frame-timeline-time">{(frame / doc.fps).toFixed(2)}s</span>
    <span class="spacer"></span>
    <IconButton action={Action.GraphMode} size={14} pressed={graphOpen} onclick={() => (graphOpen = !graphOpen)} />
  </div>
  {#if remapped}<TimeRemap {doc} clip={remapped} {frame} {onchange} />{/if}
  <div class="body">
    {#if graphOpen}
      <GraphEditor {doc} {frame} {selection} bind:keySelection {camera} {onchange} />
    {:else}
      <MotionTimeline {doc} bind:frame={() => frame, scrub} bind:selection={() => selection, onselect} bind:keySelection bind:camera bind:zoom snap={Snap.On} {onchange} />
    {/if}
  </div>
</section>

<style>
  .timeline {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 240px;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg);
    border-top: 1px solid var(--ui-line, #e5e5e5);
    color: var(--ui-ink);
    z-index: 5;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
  }

  .spacer {
    flex: 1;
  }

  .time {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }

  .body {
    flex: 1;
    min-height: 0;
  }
</style>
