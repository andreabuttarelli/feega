<script lang="ts">
  import Maximize from '@lucide/svelte/icons/maximize';
  import ClipboardCopy from '@lucide/svelte/icons/clipboard-copy';
  import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
  import type { MotionDoc } from '$lib/motion/doc';
  import { Interp, type Keyframe } from '$lib/motion/keyframes';
  import { EASE_PRESETS, EASE_PRESET_IDS, EasePreset, GraphMode, KeyEnd, curvePoints, dragHandle, easeHandles, fitView, handlePoints, type GraphPoint, type GraphView } from '$lib/motion/graph';
  import { applyEasePreset, copyEase, pasteEase, setKeyEase, type EaseBoard, type KeyRef } from '$lib/motion/timeline';
  import { graphLanes, type GraphLane } from '$lib/motion/timeline-view';

  const CURVE_STEPS = 240;
  const FIT_PAD = 0.1;
  const KEY_PX = 7;
  const HANDLE_PX = 6;
  const MARGIN_PX = 24;

  const F9_PRESET: Record<string, EasePreset> = { plain: EasePreset.EasyEase, shift: EasePreset.EasyEaseIn, modShift: EasePreset.EasyEaseOut };

  let {
    doc,
    frame,
    selection,
    keySelection = $bindable<KeyRef[]>([]),
    camera,
    onchange
  }: { doc: MotionDoc; frame: number; selection: string[]; keySelection?: KeyRef[]; camera: boolean; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let mode = $state(GraphMode.Value);
  let active = $state<string | null>(null);
  let width = $state(800);
  let height = $state(240);
  let fitted = $state<GraphView | null>(null);
  let draft = $state<MotionDoc | null>(null);
  let drag: { index: number; end: KeyEnd; base: GraphLane } | null = null;
  let board = $state<EaseBoard | null>(null);
  let svg = $state<SVGSVGElement | null>(null);

  const shown = $derived(draft ?? doc);
  const lanes = $derived(graphLanes(shown, selection, keySelection, camera));
  const lane = $derived<GraphLane | null>(lanes.find((l) => `${l.clipId} ${l.prop}` === active) ?? lanes[0] ?? null);
  const curve = $derived(lane ? curvePoints(lane.track, mode, shown.fps, CURVE_STEPS) : []);
  const view = $derived(fitted ?? (curve.length ? fitView([...curve, ...handleSpots()], FIT_PAD) : null));

  function laneKey(l: GraphLane): string {
    return `${l.clipId} ${l.prop}`;
  }

  function bezierSegment(i: number): boolean {
    const track = lane!.track;
    return (track[i].out ?? Interp.Bezier) === Interp.Bezier && (track[i + 1].in ?? Interp.Bezier) === Interp.Bezier;
  }

  const HANDLE_AT: Record<GraphMode, (a: Keyframe, b: Keyframe) => Record<KeyEnd, GraphPoint>> = {
    [GraphMode.Value]: (a, b) => handlePoints(a, b),
    [GraphMode.Speed]: (a, b) => {
      const h = easeHandles(a, b, shown.fps);
      const dt = b.frame - a.frame;
      return { [KeyEnd.Out]: { frame: a.frame + h.outInfluence * dt, value: h.outSpeed }, [KeyEnd.In]: { frame: b.frame - h.inInfluence * dt, value: h.inSpeed } };
    }
  };

  function handleSpots(): GraphPoint[] {
    if (!lane) {
      return [];
    }
    return lane.track.slice(0, -1).flatMap((k, i) => (bezierSegment(i) ? Object.values(HANDLE_AT[mode](k, lane.track[i + 1])) : []));
  }

  function keyValue(k: Keyframe): number {
    return mode === GraphMode.Value ? Number(k.value) : (curve.reduce((best, p) => (Math.abs(p.frame - k.frame) < Math.abs(best.frame - k.frame) ? p : best), curve[0])?.value ?? 0);
  }

  function sx(f: number): number {
    const [a, b] = view!.frames;
    return MARGIN_PX + ((f - a) / (b - a)) * (width - 2 * MARGIN_PX);
  }

  function sy(v: number): number {
    const [a, b] = view!.values;
    return height - MARGIN_PX - ((v - a) / (b - a)) * (height - 2 * MARGIN_PX);
  }

  function pointAt(e: PointerEvent): GraphPoint {
    const rect = svg!.getBoundingClientRect();
    const [fa, fb] = view!.frames;
    const [va, vb] = view!.values;
    return {
      frame: fa + ((e.clientX - rect.left - MARGIN_PX) / (width - 2 * MARGIN_PX)) * (fb - fa),
      value: va + ((height - MARGIN_PX - (e.clientY - rect.top)) / (height - 2 * MARGIN_PX)) * (vb - va)
    };
  }

  function refOf(k: Keyframe): KeyRef {
    return { clipId: lane!.clipId, prop: lane!.prop, frame: k.frame };
  }

  function grab(e: PointerEvent, index: number, end: KeyEnd) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    fitted = view;
    drag = { index, end, base: lane! };
  }

  function move(e: PointerEvent) {
    if (!drag) {
      return;
    }
    const { base, index, end } = drag;
    const a = base.track[index];
    const at = pointAt(e);
    const ease = dragHandle(a, base.track[index + 1], end, { ...at, frame: at.frame - base.from }, mode, doc.fps);
    const result = setKeyEase(doc, refOf(a), ease);
    if (result.ok) {
      draft = result.doc;
    }
  }

  function release() {
    if (drag && draft) {
      onchange(draft, 'Shaped an ease');
    }
    drag = null;
    draft = null;
  }

  function targets(): KeyRef[] {
    if (!lane) {
      return [];
    }
    const picked = keySelection.filter((r) => r.clipId === lane.clipId && r.prop === lane.prop);
    return picked.length ? picked : lane.track.map(refOf);
  }

  function preset(id: EasePreset) {
    const result = applyEasePreset(doc, targets(), id);
    if (result.ok) {
      onchange(result.doc, EASE_PRESETS[id].label);
    }
  }

  function copy() {
    const [first] = targets();
    board = first ? copyEase(doc, first) : null;
  }

  function paste() {
    if (!board) {
      return;
    }
    const result = pasteEase(doc, targets(), board);
    if (result.ok) {
      onchange(result.doc, 'Pasted an ease');
    }
  }

  function pickKey(e: PointerEvent, k: Keyframe) {
    e.stopPropagation();
    const ref = refOf(k);
    keySelection = e.shiftKey ? [...keySelection, ref] : [ref];
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'F9' || (e.target as HTMLElement | null)?.closest('input, textarea, select')) {
      return;
    }
    e.preventDefault();
    const mod = e.metaKey || e.ctrlKey;
    preset(F9_PRESET[mod && e.shiftKey ? 'modShift' : e.shiftKey ? 'shift' : 'plain']);
  }

</script>

<svelte:window onkeydown={onKey} />

<div class="graph" data-testid="graph-editor">
  <div class="bar">
    <div class="seg" role="group" aria-label="Graph">
      <button type="button" class:on={mode === GraphMode.Value} aria-pressed={mode === GraphMode.Value} onclick={() => ((mode = GraphMode.Value), (fitted = null))}>Value</button>
      <button type="button" class:on={mode === GraphMode.Speed} aria-pressed={mode === GraphMode.Speed} onclick={() => ((mode = GraphMode.Speed), (fitted = null))}>Speed</button>
    </div>
    <select aria-label="Property" value={lane ? laneKey(lane) : ''} onchange={(e) => ((active = e.currentTarget.value), (fitted = null))}>
      {#each lanes as l (laneKey(l))}<option value={laneKey(l)}>{l.label}</option>{/each}
    </select>
    <span class="sep"></span>
    {#each EASE_PRESET_IDS.slice(0, 3) as id (id)}
      <button type="button" data-preset={id} title={EASE_PRESETS[id].label} onclick={() => preset(id)}>{EASE_PRESETS[id].label.replace(/ \(.*\)/, '')}</button>
    {/each}
    <select aria-label="Apple ease" value="" onchange={(e) => (preset(e.currentTarget.value as EasePreset), (e.currentTarget.value = ''))}>
      <option value="" disabled>Apple curves</option>
      {#each EASE_PRESET_IDS.slice(3) as id (id)}<option value={id}>{EASE_PRESETS[id].label}</option>{/each}
    </select>
    <span class="sep"></span>
    <button type="button" title="Copy ease" aria-label="Copy ease" onclick={copy}><ClipboardCopy size={14} /></button>
    <button type="button" title="Paste ease" aria-label="Paste ease" disabled={!board} onclick={paste}><ClipboardPaste size={14} /></button>
    <button type="button" title="Fit to view" aria-label="Fit to view" onclick={() => (fitted = null)}><Maximize size={14} /></button>
  </div>

  <div class="plot" bind:clientWidth={width} bind:clientHeight={height}>
    {#if lane && view}
      <svg bind:this={svg} {width} {height} role="application" aria-label="Graph editor" onpointermove={move} onpointerup={release}>
        <line class="zero" x1={0} x2={width} y1={sy(0)} y2={sy(0)} />
        <polyline class="curve" points={curve.map((p) => `${sx(lane.from + p.frame)},${sy(p.value)}`).join(' ')} />
        {#each lane.track.slice(0, -1) as k, i (k.frame)}
          {#if bezierSegment(i)}
            {@const spots = HANDLE_AT[mode](k, lane.track[i + 1])}
            {#each [KeyEnd.Out, KeyEnd.In] as end (end)}
              {@const owner = end === KeyEnd.Out ? k : lane.track[i + 1]}
              <line class="arm" x1={sx(lane.from + owner.frame)} y1={sy(keyValue(owner))} x2={sx(lane.from + spots[end].frame)} y2={sy(spots[end].value)} />
              <rect class="handle" role="slider" tabindex="-1" aria-label={`${end} handle`} aria-valuenow={spots[end].value} data-handle={`${i}:${end}`} x={sx(lane.from + spots[end].frame) - HANDLE_PX / 2} y={sy(spots[end].value) - HANDLE_PX / 2} width={HANDLE_PX} height={HANDLE_PX} onpointerdown={(e) => grab(e, i, end)} />
            {/each}
          {/if}
        {/each}
        {#each lane.track as k (k.frame)}
          <rect
            class="key"
            class:picked={keySelection.some((r) => r.clipId === lane.clipId && r.prop === lane.prop && r.frame === k.frame)}
            role="button"
            tabindex="-1"
            aria-label={`Keyframe at ${lane.from + k.frame}`}
            x={sx(lane.from + k.frame) - KEY_PX / 2}
            y={sy(keyValue(k)) - KEY_PX / 2}
            width={KEY_PX}
            height={KEY_PX}
            onpointerdown={(e) => pickKey(e, k)}
          />
        {/each}
        <line class="playhead" x1={sx(frame)} x2={sx(frame)} y1={0} y2={height} />
      </svg>
    {:else}
      <p class="empty">Select a clip with keyframes, or keyframes, to edit their curves.</p>
    {/if}
  </div>
</div>

<style>
  .graph {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-top: 1px solid var(--ui-line);
    background: var(--ui-bg);
    font-size: var(--ui-text-xs);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--ui-line);
    flex-wrap: wrap;
  }

  .bar button,
  .bar select {
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  .bar button:disabled {
    opacity: 0.4;
  }

  .seg {
    display: flex;
  }

  .seg button.on {
    background: var(--ui-accent-wash);
    border-color: var(--ui-accent);
    color: var(--ui-accent);
  }

  .sep {
    width: 1px;
    height: 16px;
    background: var(--ui-line);
  }

  .plot {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--ui-surface);
  }

  svg {
    position: absolute;
    inset: 0;
    touch-action: none;
  }

  .zero {
    stroke: var(--ui-line-strong);
    stroke-dasharray: 3 3;
  }

  .curve {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5;
  }

  .arm {
    stroke: var(--ui-ink-3);
  }

  .handle {
    fill: var(--ui-bg);
    stroke: var(--ui-ink-2);
    cursor: grab;
  }

  .key {
    fill: var(--ui-bg);
    stroke: var(--ui-ink);
    cursor: pointer;
  }

  .key.picked {
    fill: var(--ui-accent);
    stroke: var(--ui-accent);
  }

  .playhead {
    stroke: var(--ui-ink);
  }

  .empty {
    padding: 16px;
    color: var(--ui-ink-3);
  }
</style>
