<script lang="ts">
  import GraphEditor from '$lib/components/motion/GraphEditor.svelte';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import MotionTimeline from '$lib/components/motion/MotionTimeline.svelte';
  import TimeRemap from '$lib/components/motion/TimeRemap.svelte';
  import { advance } from '$lib/canvas/frame-playhead';
  import { Action, type ActionId } from '$lib/motion/actions';
  import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
  import { frameBar } from '$lib/canvas/frame-bar.svelte';
  import { frameBarActions } from '$lib/canvas/frame-inspector';
  import { EditMode } from '$lib/motion/edit-mode';
  import { Snap } from '$lib/motion/timeline-view';
  import type { KeyRef } from '@feega/motion-core/motion/timeline';
  import type { CommentMark } from '$lib/canvas/comment-marks';

  let {
    doc,
    frame,
    selection,
    mode = EditMode.Motion,
    onframe,
    onselect,
    onmode = () => {},
    onaction = () => {},
    marks = [],
    onmark = () => {},
    onpin,
    onchange
  }: { doc: MotionDoc; frame: number; selection: string[]; mode?: EditMode; onframe: (frame: number) => void; onselect: (ids: string[]) => void; onmode?: () => void; onaction?: (id: ActionId) => void; marks?: CommentMark[]; onmark?: (id: string, frame: number) => void; onpin?: () => void; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const MODE_LABEL: Record<EditMode, string> = { [EditMode.Design]: 'Design: edits set the resting state', [EditMode.Motion]: 'Animate: edits key at the playhead' };

  const GROUPING: readonly ActionId[] = [Action.Group, Action.Ungroup];

  let playing = $state(false);
  let graphOpen = $state(false);
  let camera = $state(false);
  let zoom = $state(1);
  let keySelection = $state<KeyRef[]>([]);
  let section = $state<HTMLElement | null>(null);
  let raf = 0;
  let last = 0;
  let head = 0;

  const grouping = $derived(frameBarActions(doc, selection).filter((id) => GROUPING.includes(id)));

  const remapped = $derived.by(() => {
    const found = selection.length === 1 ? findClip(doc, selection[0]) : null;
    return found?.clip.component === 'Video' ? found.clip : null;
  });

  $effect(() => {
    const mine = section;
    frameBar.timeline = mine;
    return () => {
      if (frameBar.timeline === mine) {
        frameBar.timeline = null;
      }
    };
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

<section bind:this={section} class="timeline" data-testid="frame-timeline" data-dock="timeline">
  <div class="bar">
    <IconButton action={playing ? Action.Pause : Action.Play} class="play" fill="currentColor" data-testid="frame-timeline-play" onclick={toggle} />
    <span class="time" data-testid="frame-timeline-time">{(frame / doc.fps).toFixed(2)}s</span>
    {#each grouping as id (id)}<IconButton action={id} size={14} data-testid={`frame-timeline-${id}`} onclick={() => onaction(id)} />{/each}
    {#if onpin}<button type="button" class="pin-here" data-testid="frame-timeline-pin" onclick={onpin}>Comment here</button>{/if}
    <span class="spacer"></span>
    <IconButton action={Action.ToggleEditMode} size={14} pressed={mode === EditMode.Motion} label={MODE_LABEL[mode]} data-testid="frame-timeline-mode" data-mode={mode} onclick={onmode} />
    <IconButton action={Action.GraphMode} size={14} pressed={graphOpen} onclick={() => (graphOpen = !graphOpen)} />
  </div>
  {#if marks.length}
    <div class="marks" data-testid="frame-timeline-marks">
      {#each marks as m (m.id)}
        <button type="button" class="mark" data-testid="frame-timeline-mark" data-thread={m.id} aria-label={`Comment ${m.number} at ${(m.frame / doc.fps).toFixed(2)}s`} style={`left:${(m.frame / Math.max(1, doc.durationInFrames - 1)) * 100}%`} onclick={() => { scrub(m.frame); onmark(m.id, m.frame); }}>{m.number}</button>
      {/each}
    </div>
  {/if}
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

  .pin-here {
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    padding: 2px 8px;
    background: none;
    color: inherit;
    border: 1px solid var(--ui-line, #e5e5e5);
    border-radius: var(--ui-radius-sm, 4px);
  }

  .marks {
    position: relative;
    height: 18px;
    margin: 0 12px;
  }

  .mark {
    position: absolute;
    top: 0;
    width: 18px;
    height: 18px;
    padding: 0;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    color: var(--paper, #fff);
    background: #0b6bff;
    border: 0;
    border-radius: 9999px;
  }

  .body {
    flex: 1;
    min-height: 0;
  }
</style>
