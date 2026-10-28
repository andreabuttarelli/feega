<script lang="ts">
  import GraphEditor from '$lib/components/motion/GraphEditor.svelte';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import MotionTimeline from '$lib/components/motion/MotionTimeline.svelte';
  import TimeRemap from '$lib/components/motion/TimeRemap.svelte';
  import TrackPanel from '$lib/components/motion/TrackPanel.svelte';
  import { Wrap, advance } from '$lib/canvas/frame-playhead';
  import { closeLoop, loopRange, setWorkArea } from '@feega/motion-core/motion/organize';
  import { interactiveOf } from '@feega/motion-core/motion/interactive/settings';
  import { setInteractive } from '$lib/motion/interactive/presets';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { Action, Tool, type ActionId } from '$lib/motion/actions';
  import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
  import { proxySetting } from '$lib/motion/gpu/proxy-setting.svelte';
  import { frameBar } from '$lib/canvas/frame-bar.svelte';
  import { frameBarActions } from '$lib/canvas/frame-inspector';
  import { EditMode, MODE_LABEL } from '$lib/motion/edit-mode';
  import { Command, commandFor, isTyping } from '$lib/motion/shortcuts';
  import type { FrameRange } from '@feega/motion-core/motion/gpu-full/ram-preview';
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
    ram = [],
    onram = () => {},
    assetUrl,
    onchange
  }: { doc: MotionDoc; frame: number; selection: string[]; mode?: EditMode; onframe: (frame: number) => void; onselect: (ids: string[]) => void; onmode?: () => void; onaction?: (id: ActionId) => void; marks?: CommentMark[]; onmark?: (id: string, frame: number) => void; onpin?: () => void; ram?: FrameRange[]; onram?: () => void; assetUrl?: (assetId: string) => string; onchange: (doc: MotionDoc, summary: string) => void } = $props();

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

  const looping = $derived(interactiveOf(doc).loop);
  const LOOP_LABEL: Record<Wrap, string> = { [Wrap.Loop]: 'Loop playback: on', [Wrap.Stop]: 'Loop playback: off' };
  const wrap = $derived(looping ? Wrap.Loop : Wrap.Stop);

  function tick(now: number) {
    const range = loopRange(doc);
    const next = advance({ head, ms: now - last, fps: doc.fps, range, wrap });
    last = now;
    if (next === null) {
      playing = false;
      onframe(range.to - 1);
      return;
    }
    head = next;
    onframe(Math.floor(head));
    raf = requestAnimationFrame(tick);
  }

  function toggle() {
    playing = !playing;
    cancelAnimationFrame(raf);
    if (!playing) {
      return;
    }
    const range = loopRange(doc);
    const inside = frame >= range.from && frame < range.to - 1;
    head = inside ? frame : range.from;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function edit(result: OpResult, summary: string) {
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  const WORK_EDGE: Partial<Record<Command, (f: number) => OpResult>> = {
    [Command.WorkIn]: (f) => setWorkArea(doc, { from: f, to: loopRange(doc).to }),
    [Command.WorkOut]: (f) => setWorkArea(doc, { from: loopRange(doc).from, to: f + 1 })
  };

  function scrub(next: number) {
    playing = false;
    cancelAnimationFrame(raf);
    onframe(next);
  }

  function onKey(e: KeyboardEvent) {
    if (isTyping(e.target as Parameters<typeof isTyping>[0])) {
      return;
    }
    const command = commandFor({ key: e.key, code: e.code, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey }, mode);
    if (command === Command.RamPreview) {
      e.preventDefault();
      onram();
      return;
    }
    const workEdge = command ? WORK_EDGE[command] : undefined;
    if (workEdge) {
      e.preventDefault();
      edit(workEdge(frame), 'Set the loop region');
    }
  }

  $effect(() => () => cancelAnimationFrame(raf));
</script>

<svelte:window onkeydown={onKey} />

<section bind:this={section} class="timeline" data-testid="frame-timeline" data-dock="timeline">
  <div class="bar">
    <IconButton action={playing ? Action.Pause : Action.Play} class="play" fill="currentColor" data-testid="frame-timeline-play" onclick={toggle} />
    <IconButton action={Tool.Loop} size={14} pressed={looping} label={LOOP_LABEL[wrap]} data-testid="frame-timeline-loop" onclick={() => edit(setInteractive(doc, { loop: !looping }), looping ? 'Turned looping off' : 'Turned looping on')} />
    <IconButton action={Tool.CloseLoop} size={14} data-testid="frame-timeline-seamless" onclick={() => edit(closeLoop(doc), 'Made the loop seamless')} />
    {#if doc.workArea}<IconButton action={Tool.ClearWorkArea} size={14} data-testid="frame-timeline-clear-loop" onclick={() => edit(setWorkArea(doc, null), 'Cleared the loop region')} />{/if}
    <IconButton action={Command.RamPreview} size={14} data-testid="frame-timeline-ram" onclick={onram} />
    <span class="time" data-testid="frame-timeline-time">{(frame / doc.fps).toFixed(2)}s</span>
    {#each grouping as id (id)}<IconButton action={id} size={14} data-testid={`frame-timeline-${id}`} onclick={() => onaction(id)} />{/each}
    {#if onpin}<button type="button" class="pin-here" data-testid="frame-timeline-pin" onclick={onpin}>Comment here</button>{/if}
    <span class="spacer"></span>
    <button type="button" class="pin-here" data-testid="frame-timeline-proxies" aria-pressed={proxySetting.on} title="Play and scrub a light copy of large videos. Export always uses the original." onclick={() => proxySetting.toggle()}>Use proxies</button>
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
  {#if remapped}
    <div class="tools" data-testid="frame-timeline-tools">
      <TimeRemap {doc} clip={remapped} {frame} {onchange} />
      {#if assetUrl}<TrackPanel {doc} clip={remapped} {frame} {assetUrl} {onchange} />{/if}
    </div>
  {/if}
  <div class="body">
    {#if graphOpen}
      <GraphEditor {doc} {frame} {selection} bind:keySelection {camera} {onchange} />
    {:else}
      <MotionTimeline {doc} bind:frame={() => frame, scrub} bind:selection={() => selection, onselect} bind:keySelection bind:camera bind:zoom snap={Snap.On} cached={ram} {onchange} />
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

  @media (min-width: 768px) {
    .timeline {
      left: var(--shell-left, 0px);
      right: var(--shell-right, 0px);
      bottom: 12px;
      overflow: hidden;
      border-top: 0;
      border-radius: var(--ui-radius-lg);
      background: var(--ui-panel-raised);
      box-shadow: var(--ui-shadow-float);
      transition: left var(--ui-dur-fast) var(--ui-ease), right var(--ui-dur-fast) var(--ui-ease);
    }
  }

  @media (min-width: 768px) and (max-width: 1180px) {
    .timeline {
      left: 68px;
      right: 12px;
    }
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

  .tools {
    flex: 0 1 auto;
    min-height: 0;
    max-height: 70%;
    overflow-y: auto;
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
