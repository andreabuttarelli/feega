<script lang="ts">
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { COMPONENTS, TrackKind } from '$lib/motion/components';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { ClipEdge, moveClip, moveTrack, trimClip, type OpResult } from '$lib/motion/timeline';
  import { Snap, frameAt, pxPerFrame, rulerTicks, snapped } from '$lib/motion/timeline-view';

  const EDGE_PX = 7;
  const HEADER_PX = 132;

  enum Drag {
    Move = 'move',
    TrimStart = 'trim-start',
    TrimEnd = 'trim-end',
    Scrub = 'scrub'
  }

  type Gesture = { kind: Drag; clipId: string; trackId: string; grabFrame: number; originFrom: number; base: MotionDoc };

  let {
    doc,
    frame = $bindable(0),
    selection = $bindable<string[]>([]),
    zoom,
    snap,
    onchange
  }: { doc: MotionDoc; frame?: number; selection?: string[]; zoom: number; snap: Snap; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let draft = $state<MotionDoc | null>(null);
  let gesture: Gesture | null = null;
  let lanes = $state<HTMLDivElement | null>(null);

  const shown = $derived(draft ?? doc);
  const ppf = $derived(pxPerFrame(zoom));
  const width = $derived(Math.max(shown.durationInFrames * ppf + 120, 400));
  const ticks = $derived(rulerTicks(shown.durationInFrames, zoom));

  function frameOfPointer(e: PointerEvent): number {
    const rect = lanes!.getBoundingClientRect();
    return frameAt(e.clientX - rect.left + lanes!.scrollLeft - HEADER_PX, zoom);
  }

  function select(clipId: string, e: PointerEvent) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      selection = selection.includes(clipId) ? selection.filter((id) => id !== clipId) : [...selection, clipId];
      return;
    }
    if (!selection.includes(clipId)) {
      selection = [clipId];
    }
  }

  function dragKindAt(e: PointerEvent, el: HTMLElement): Drag {
    const rect = el.getBoundingClientRect();
    if (e.clientX - rect.left <= EDGE_PX) {
      return Drag.TrimStart;
    }
    if (rect.right - e.clientX <= EDGE_PX) {
      return Drag.TrimEnd;
    }
    return Drag.Move;
  }

  function startClip(e: PointerEvent, clip: MotionClip, trackId: string) {
    e.stopPropagation();
    select(clip.id, e);
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    gesture = { kind: dragKindAt(e, el), clipId: clip.id, trackId, grabFrame: frameOfPointer(e), originFrom: clip.from, base: doc };
  }

  function startScrub(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind: Drag.Scrub, clipId: '', trackId: '', grabFrame: 0, originFrom: 0, base: doc };
    frame = Math.min(frameOfPointer(e), doc.durationInFrames - 1);
  }

  function trackUnder(e: PointerEvent): string | null {
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.trackId);
    return (hit as HTMLElement | undefined)?.dataset.trackId ?? null;
  }

  const GESTURES: Record<Exclude<Drag, Drag.Scrub>, (g: Gesture, at: number, e: PointerEvent) => OpResult> = {
    [Drag.Move]: (g, at, e) => {
      const from = g.originFrom + (at - g.grabFrame);
      const clip = g.base.tracks.flatMap((t) => t.clips).find((c) => c.id === g.clipId)!;
      const start = snapped(g.base, from, { playhead: frame, exclude: [g.clipId], zoom, snap });
      const endSnap = snapped(g.base, from + clip.durationInFrames, { playhead: frame, exclude: [g.clipId], zoom, snap }) - clip.durationInFrames;
      const target = start !== from ? start : endSnap;
      const over = trackUnder(e);
      const sameKind = g.base.tracks.find((t) => t.id === over)?.kind === g.base.tracks.find((t) => t.id === g.trackId)?.kind;
      return moveClip(g.base, g.clipId, { from: target, trackId: over && sameKind ? over : undefined });
    },
    [Drag.TrimStart]: (g, at) => trimClip(g.base, g.clipId, ClipEdge.Start, snapped(g.base, at, { playhead: frame, exclude: [g.clipId], zoom, snap })),
    [Drag.TrimEnd]: (g, at) => trimClip(g.base, g.clipId, ClipEdge.End, snapped(g.base, at, { playhead: frame, exclude: [g.clipId], zoom, snap }))
  };

  function onMove(e: PointerEvent) {
    if (!gesture) {
      return;
    }
    const at = frameOfPointer(e);
    if (gesture.kind === Drag.Scrub) {
      frame = Math.min(at, doc.durationInFrames - 1);
      return;
    }
    const result = GESTURES[gesture.kind](gesture, at, e);
    if (result.ok) {
      draft = result.doc;
    }
  }

  const SUMMARY: Record<Drag, string> = { [Drag.Move]: 'Moved a clip', [Drag.TrimStart]: 'Trimmed a clip', [Drag.TrimEnd]: 'Trimmed a clip', [Drag.Scrub]: '' };

  function onUp() {
    if (gesture && draft && gesture.kind !== Drag.Scrub) {
      onchange(draft, SUMMARY[gesture.kind]);
    }
    gesture = null;
    draft = null;
  }

  function reorder(trackId: string, delta: number) {
    const index = doc.tracks.findIndex((t) => t.id === trackId);
    const result = moveTrack(doc, trackId, index + delta);
    if (result.ok) {
      onchange(result.doc, 'Reordered tracks');
    }
  }

  function clipLabel(clip: MotionClip): string {
    const p = clip.props as { text?: string; title?: string };
    return p.text?.split('\n')[0] ?? p.title ?? COMPONENTS[clip.component].label;
  }
</script>

<svelte:window onpointermove={onMove} onpointerup={onUp} />

<div class="timeline" bind:this={lanes} data-testid="motion-timeline">
  <div class="inner" style={`width: ${width + HEADER_PX}px;`}>
    <div class="ruler" role="slider" tabindex="-1" aria-label="Playhead" aria-valuenow={frame} onpointerdown={startScrub}>
      <div class="corner" style={`width: ${HEADER_PX}px;`}></div>
      {#each ticks as tick (tick.frame)}
        <span class="tick" class:major={tick.label} style={`left: ${HEADER_PX + tick.frame * ppf}px;`}>
          {#if tick.label}<em>{tick.label}</em>{/if}
        </span>
      {/each}
    </div>

    {#each shown.tracks as track, index (track.id)}
      <div class="lane" data-track-id={track.id} class:audio={track.kind === TrackKind.Audio}>
        <div class="head" style={`width: ${HEADER_PX}px;`}>
          <span class="name">{track.name || track.id}</span>
          <button type="button" aria-label="Move track up" disabled={index === 0} onclick={() => reorder(track.id, -1)}><ChevronUp size={12} /></button>
          <button type="button" aria-label="Move track down" disabled={index === shown.tracks.length - 1} onclick={() => reorder(track.id, 1)}><ChevronDown size={12} /></button>
        </div>
        <div class="clips" data-track-id={track.id}>
          {#each track.clips as clip (clip.id)}
            <div
              class="bar"
              class:selected={selection.includes(clip.id)}
              data-clip-id={clip.id}
              role="button"
              tabindex="0"
              aria-label={`${COMPONENTS[clip.component].label} clip`}
              style={`left: ${clip.from * ppf}px; width: ${Math.max(4, clip.durationInFrames * ppf)}px;`}
              onpointerdown={(e) => startClip(e, clip as MotionClip, track.id)}
            >
              <span class="kind">{COMPONENTS[clip.component].label}</span>
              <span class="label">{clipLabel(clip as MotionClip)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}

    <div class="playhead" style={`left: ${HEADER_PX + frame * ppf}px;`}></div>
  </div>
</div>

<style>
  .timeline {
    position: relative;
    overflow: auto;
    background: var(--paper);
    border-top: 1px solid var(--line);
    user-select: none;
    font-size: 11px;
    height: 100%;
  }

  .inner {
    position: relative;
    min-height: 100%;
  }

  .ruler {
    position: sticky;
    top: 0;
    z-index: 3;
    height: 24px;
    background: var(--paper-2);
    border-bottom: 1px solid var(--line);
    cursor: ew-resize;
  }

  .corner {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--paper-2);
    border-right: 1px solid var(--line);
  }

  .tick {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 5px;
    background: var(--line);
  }

  .tick.major {
    height: 10px;
    background: var(--ink-soft);
  }

  .tick em {
    position: absolute;
    bottom: 11px;
    left: 3px;
    font-style: normal;
    font-family: 'Fragment Mono', ui-monospace, monospace;
    color: var(--ink-soft);
    white-space: nowrap;
  }

  .lane {
    position: relative;
    display: flex;
    height: 40px;
    border-bottom: 1px solid var(--line);
  }

  .lane.audio .bar {
    background: color-mix(in srgb, #d97706 18%, var(--paper));
    border-color: #d97706;
  }

  .head {
    position: sticky;
    left: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
    background: var(--paper-2);
    border-right: 1px solid var(--line);
    flex-shrink: 0;
  }

  .head .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .head button {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    color: var(--ink-soft);
  }

  .head button:disabled {
    opacity: 0.3;
  }

  .clips {
    position: relative;
    flex: 1;
  }

  .bar {
    position: absolute;
    top: 5px;
    bottom: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 8px;
    overflow: hidden;
    background: color-mix(in srgb, #0099ff 14%, var(--paper));
    border: 1px solid #0099ff;
    cursor: grab;
    white-space: nowrap;
  }

  .bar::before,
  .bar::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: ew-resize;
  }

  .bar::before {
    left: 0;
  }

  .bar::after {
    right: 0;
  }

  .bar.selected {
    outline: 2px solid #a855f7;
    outline-offset: 1px;
    z-index: 1;
  }

  .bar .kind {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 9px;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .bar .label {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ink);
  }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #e11d48;
    pointer-events: none;
    z-index: 4;
  }
</style>
