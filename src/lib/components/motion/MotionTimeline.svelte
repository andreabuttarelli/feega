<script lang="ts">
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { COMPONENTS, TrackKind } from '$lib/motion/components';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { ClipEdge, moveClip, moveKeyframes, moveTrack, setKeyEase, trimClip, type KeyRef, type OpResult } from '$lib/motion/timeline';
  import { Grip, Snap, edgeHandles, frameAt, keyLanes, pxPerFrame, rulerTicks, snapped, stackRows, type KeyLane } from '$lib/motion/timeline-view';
  import { MASK_KINDS, Matte } from '$lib/motion/mask';
  import type { MotionTrack } from '$lib/motion/doc';
  import { Source, type EaseSpec } from '$lib/motion/keyframes';
  import EasePicker from './EasePicker.svelte';

  const HEADER_PX = 132;
  const ROW_PX = 30;
  const LANE_PAD_PX = 5;

  const KEY_ROW_PX = 20;
  const DIAMOND_PX = 10;

  const Drag = { Move: 'move', TrimStart: 'trim-start', TrimEnd: 'trim-end', Scrub: 'scrub', Keys: 'keys' } as const;
  type Drag = (typeof Drag)[keyof typeof Drag];

  type Gesture = { kind: Drag; clipId: string; trackId: string; grabFrame: number; originFrom: number; base: MotionDoc; refs: KeyRef[]; delta: number };

  let {
    doc,
    frame = $bindable(0),
    selection = $bindable<string[]>([]),
    keySelection = $bindable<KeyRef[]>([]),
    zoom,
    snap,
    onchange
  }: { doc: MotionDoc; frame?: number; selection?: string[]; keySelection?: KeyRef[]; zoom: number; snap: Snap; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let collapsed = $state<string[]>([]);
  let easing = $state<{ ref: KeyRef; ease: EaseSpec; left: number; top: number } | null>(null);

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

  const GRIP_DRAG: Record<Grip, Drag> = { [Grip.Start]: Drag.TrimStart, [Grip.End]: Drag.TrimEnd };

  function startClip(e: PointerEvent, clip: MotionClip, trackId: string, kind: Drag = Drag.Move) {
    e.stopPropagation();
    select(clip.id, e);
    keySelection = [];
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind, clipId: clip.id, trackId, grabFrame: frameOfPointer(e), originFrom: clip.from, base: doc, refs: [], delta: 0 };
  }

  const sameKey = (a: KeyRef, b: KeyRef) => a.clipId === b.clipId && a.prop === b.prop && a.frame === b.frame;

  function startKey(e: PointerEvent, clip: MotionClip, ref: KeyRef) {
    e.stopPropagation();
    easing = null;
    const picked = keySelection.some((k) => sameKey(k, ref));
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      keySelection = picked ? keySelection.filter((k) => !sameKey(k, ref)) : [...keySelection, ref];
    } else if (!picked) {
      keySelection = [ref];
    }
    frame = clip.from + ref.frame;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind: Drag.Keys, clipId: clip.id, trackId: '', grabFrame: clip.from + ref.frame, originFrom: clip.from + ref.frame, base: doc, refs: keySelection, delta: 0 };
  }

  function openEase(e: MouseEvent, clip: MotionClip, ref: KeyRef, ease: EaseSpec) {
    e.stopPropagation();
    const rect = lanes!.getBoundingClientRect();
    easing = { ref, ease, left: e.clientX - rect.left + lanes!.scrollLeft, top: e.clientY - rect.top + lanes!.scrollTop + 8 };
  }

  function pickEase(ease: EaseSpec) {
    if (!easing) {
      return;
    }
    const result = setKeyEase(doc, easing.ref, ease);
    if (result.ok) {
      easing = { ...easing, ease };
      onchange(result.doc, 'Changed an ease');
    }
  }

  function toggleLanes(e: Event, clipId: string) {
    e.stopPropagation();
    collapsed = collapsed.includes(clipId) ? collapsed.filter((id) => id !== clipId) : [...collapsed, clipId];
  }

  function laneClips(track: MotionTrack): MotionClip[] {
    return (track.clips as MotionClip[]).filter((c) => selection.includes(c.id) && !collapsed.includes(c.id) && Object.keys(c.keyframes).length > 0);
  }

  function clipById(id: string): MotionClip {
    return shown.tracks.flatMap((t) => t.clips).find((c) => c.id === id) as MotionClip;
  }

  function startScrub(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture = { kind: Drag.Scrub, clipId: '', trackId: '', grabFrame: 0, originFrom: 0, base: doc, refs: [], delta: 0 };
    frame = Math.min(frameOfPointer(e), doc.durationInFrames - 1);
  }

  function trackUnder(e: PointerEvent): string | null {
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.trackId);
    return (hit as HTMLElement | undefined)?.dataset.trackId ?? null;
  }

  const GESTURES: Record<Exclude<Drag, typeof Drag.Scrub>, (g: Gesture, at: number, e: PointerEvent) => OpResult> = {
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
    [Drag.TrimEnd]: (g, at) => trimClip(g.base, g.clipId, ClipEdge.End, snapped(g.base, at, { playhead: frame, exclude: [g.clipId], zoom, snap })),
    [Drag.Keys]: (g, at) => {
      g.delta = snapped(g.base, g.originFrom + (at - g.grabFrame), { playhead: g.originFrom, exclude: [], zoom, snap }) - g.originFrom;
      return moveKeyframes(g.base, g.refs, g.delta);
    }
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

  const SUMMARY: Record<Drag, string> = { [Drag.Move]: 'Moved a clip', [Drag.TrimStart]: 'Trimmed a clip', [Drag.TrimEnd]: 'Trimmed a clip', [Drag.Scrub]: '', [Drag.Keys]: 'Moved keyframes' };

  function onUp() {
    if (gesture && draft && gesture.kind !== Drag.Scrub) {
      onchange(draft, SUMMARY[gesture.kind]);
    }
    if (gesture?.kind === Drag.Keys && draft) {
      const delta = gesture.delta;
      keySelection = gesture.refs.map((r) => ({ ...r, frame: Math.max(0, r.frame + delta) }));
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

  {#snippet keyLane(clip: MotionClip, lane: KeyLane)}
    {@const keys = clip.keyframes[lane.prop]}
    <div class="lane sub" data-key-lane={`${clip.id}:${lane.prop}`} style={`height: ${KEY_ROW_PX}px;`}>
      <div class="head" style={`width: ${HEADER_PX}px;`}><span class="name prop">{lane.label}</span></div>
      <div class="clips">
        {#each keys.slice(0, -1) as key, i (key.frame)}
          <button
            type="button"
            class="segment"
            title="Ease"
            aria-label={`Ease after ${lane.label} keyframe`}
            style={`left: ${(clip.from + key.frame) * ppf}px; width: ${(keys[i + 1].frame - key.frame) * ppf}px;`}
            onclick={(e) => openEase(e, clip, { clipId: clip.id, prop: lane.prop, frame: key.frame }, key.ease)}
          ></button>
        {/each}
        {#each keys as key (key.frame)}
          {@const ref = { clipId: clip.id, prop: lane.prop, frame: key.frame }}
          <div
            class="diamond"
            class:picked={keySelection.some((k) => sameKey(k, ref))}
            role="button"
            tabindex="-1"
            aria-label={`${lane.label} keyframe at ${clip.from + key.frame}`}
            data-key-frame={clip.from + key.frame}
            style={`left: ${(clip.from + key.frame) * ppf - DIAMOND_PX / 2}px; width: ${DIAMOND_PX}px; height: ${DIAMOND_PX}px; top: ${(KEY_ROW_PX - DIAMOND_PX) / 2}px;`}
            onpointerdown={(e) => startKey(e, clip, ref)}
          ></div>
        {/each}
      </div>
    </div>
  {/snippet}

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
      {@const rows = stackRows(track.clips)}
      {@const rowCount = Math.max(1, ...Object.values(rows).map((r) => r + 1))}
      <div class="lane" data-track-id={track.id} class:audio={track.kind === TrackKind.Audio} style={`height: ${rowCount * ROW_PX + 2 * LANE_PAD_PX}px;`}>
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
              style={`left: ${clip.from * ppf}px; width: ${Math.max(4, clip.durationInFrames * ppf)}px; top: ${LANE_PAD_PX + rows[clip.id] * ROW_PX}px; height: ${ROW_PX - 2}px;`}
              onpointerdown={(e) => startClip(e, clip as MotionClip, track.id)}
            >
              <span class="kind">
                {COMPONENTS[clip.component].label}
                {#if Object.keys(clip.keyframes).length}
                  <button type="button" class="lanes-toggle" aria-label="Show keyframes" aria-expanded={selection.includes(clip.id) && !collapsed.includes(clip.id)} onpointerdown={(e) => e.stopPropagation()} onclick={(e) => (selection.includes(clip.id) ? toggleLanes(e, clip.id) : (selection = [clip.id]))}>◆</button>
                {/if}
                {#if clip.mask}<span class="tag" title="Masked">· mask</span>{/if}
                {#if clip.matte !== Matte.None}<span class="tag" title="Track matte">· {clip.matte} matte</span>{/if}
              </span>
              <span class="label">{clipLabel(clip as MotionClip)}</span>
            </div>
          {/each}
          {#each edgeHandles(track.clips, ppf, selection) as handle (`${handle.clipId}-${handle.grip}`)}
            <div
              class="grip"
              data-grip={handle.grip}
              data-grip-clip={handle.clipId}
              role="separator"
              aria-label={`Trim ${handle.grip}`}
              style={`left: ${handle.left}px; width: ${handle.width}px; top: ${LANE_PAD_PX + rows[handle.clipId] * ROW_PX}px; height: ${ROW_PX - 2}px;`}
              onpointerdown={(e) => startClip(e, clipById(handle.clipId), track.id, GRIP_DRAG[handle.grip])}
            ></div>
          {/each}
        </div>
      </div>
      {#each laneClips(track) as clip (clip.id)}
        {@const all = keyLanes(clip)}
        {@const masked = all.filter((l) => l.source === Source.Mask)}
        {#each all.filter((l) => l.source !== Source.Mask) as lane (lane.prop)}{@render keyLane(clip, lane)}{/each}
        {#if masked.length}
          <div class="lane sub group" data-mask-lanes={clip.id} style={`height: ${KEY_ROW_PX}px;`}>
            <div class="head" style={`width: ${HEADER_PX}px;`}><span class="name prop">Mask{clip.mask ? ` · ${MASK_KINDS[clip.mask.kind].label}` : ''}</span></div>
            <div class="clips"></div>
          </div>
          {#each masked as lane (lane.prop)}{@render keyLane(clip, lane)}{/each}
        {/if}
      {/each}
    {/each}

    {#if easing}
      <div class="ease-at" style={`left: ${Math.max(HEADER_PX, easing.left - 120)}px; top: ${easing.top}px;`}>
        <EasePicker ease={easing.ease} onpick={pickEase} onclose={() => (easing = null)} />
      </div>
    {/if}

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

  .grip {
    position: absolute;
    z-index: 2;
    cursor: ew-resize;
  }

  .grip:hover {
    background: color-mix(in srgb, #0099ff 45%, transparent);
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

  .lane.sub {
    background: var(--paper-2);
  }

  .bar .tag {
    color: #a855f7;
  }

  .lane.group .prop {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 10px;
    text-transform: uppercase;
  }

  .head .prop {
    padding-left: 12px;
    font-weight: 400;
    color: var(--ink-soft);
  }

  .segment {
    position: absolute;
    top: 50%;
    height: 8px;
    transform: translateY(-50%);
    cursor: pointer;
  }

  .segment::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    border-top: 1px dashed var(--ink-soft);
  }

  .segment:hover::after {
    border-top: 1px solid #a855f7;
  }

  .diamond {
    position: absolute;
    z-index: 2;
    background: var(--ink);
    transform: rotate(45deg) scale(0.8);
    cursor: ew-resize;
  }

  .diamond.picked {
    background: #a855f7;
    outline: 1px solid #a855f7;
    outline-offset: 2px;
  }

  .lanes-toggle {
    margin-left: 4px;
    font-size: 9px;
    color: #a855f7;
  }

  .ease-at {
    position: absolute;
    z-index: 6;
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
