<script lang="ts">
  import { hostFraction, hostWidth } from '$lib/motion/overlay-point';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { Box } from '@feega/motion-core/motion/layout';
  import { StripKind, dragStrip, layoutStrips, type Pt, type Strip } from '$lib/motion/layout/guides';
  import { setAutoLayout } from '$lib/motion/layout/ops';
  import type { AutoLayout } from '@feega/motion-core/motion/layout/model';
  import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
  import { pastSlop, type PointerPoint } from '$lib/canvas/canvas-drop';
  import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';

  let { doc, clip, measure = estimatedText, onchange }: { doc: MotionDoc; clip: MotionClip & { autoLayout: AutoLayout }; measure?: TextMeasure; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const SUMMARY: Record<StripKind, string> = {
    [StripKind.Padding]: 'Changed the padding',
    [StripKind.Gap]: 'Changed the gap'
  };

  let host = $state<HTMLDivElement | null>(null);
  let grab = $state<{ strip: Strip; from: Pt; down: PointerPoint } | null>(null);
  let live = $state<Partial<AutoLayout> | null>(null);

  const shown = $derived.by(() => {
    const result = live ? setAutoLayout(doc, clip.id, live) : null;
    return result?.ok ? result.doc : doc;
  });
  const strips = $derived(layoutStrips(shown, clip.id, measure));
  const layout = $derived(live ? { ...clip.autoLayout, ...live } : clip.autoLayout);

  type Anchor = { x: 'left' | 'right'; y: 'top' | 'bottom'; inset: 'x' | 'y' | null };

  const ANCHORS: Record<string, Anchor> = {
    gap: { x: 'left', y: 'top', inset: null },
    left: { x: 'left', y: 'top', inset: 'x' },
    right: { x: 'right', y: 'top', inset: 'x' },
    top: { x: 'left', y: 'top', inset: 'y' },
    bottom: { x: 'left', y: 'bottom', inset: 'y' }
  };

  const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

  function place(b: Box, anchor: Anchor) {
    const x = anchor.x === 'left' ? b.left : doc.width - b.left - b.width;
    const y = anchor.y === 'top' ? b.top : doc.height - b.top - b.height;
    return `${anchor.x}: ${percent(x, doc.width)}; ${anchor.y}: ${percent(y, doc.height)}; width: ${percent(b.width, doc.width)}; height: ${percent(b.height, doc.height)};`;
  }
  const valueOf = (strip: Strip) => (strip.kind === StripKind.Gap ? layout.gap : layout.padding[strip.side]);
  const keyOf = (strip: Strip) => (strip.kind === StripKind.Gap ? 'gap' : strip.side);
  const nameOf = (strip: Strip) => (strip.kind === StripKind.Gap ? 'gap' : `${strip.side} padding`);

  function local(e: PointerEvent): Pt {
    const at = hostFraction(e, host!);
    return [at.x * doc.width, at.y * doc.height];
  }

  function begin(e: PointerEvent, strip: Strip) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { strip, from: local(e), down: { x: e.clientX, y: e.clientY } };
  }

  function move(e: PointerEvent) {
    if (!grab || (!live && !pastSlop(grab.down, { x: e.clientX, y: e.clientY }))) {
      return;
    }
    const [x, y] = local(e);
    live = dragStrip(clip.autoLayout, grab.strip, [x - grab.from[0], y - grab.from[1]]);
  }

  function end() {
    const done = live;
    const kind = grab?.strip.kind;
    grab = null;
    live = null;
    if (!done || !kind) {
      return;
    }
    const result = setAutoLayout(doc, clip.id, done);
    if (result.ok) {
      onchange(result.doc, SUMMARY[kind]);
    }
  }
</script>

<div class="overlay" bind:this={host} data-testid="auto-layout-overlay" role="presentation">
  {#each strips as strip, i (i)}
    {@const anchor = ANCHORS[keyOf(strip)]}
    <div class="band" class:active={grab && keyOf(grab.strip) === keyOf(strip)} data-band={keyOf(strip)} data-inset={anchor.inset} style={place(strip.box, anchor)}>
      <button
        type="button"
        class="handle"
        class:across={strip.kind === StripKind.Gap ? layout.direction === Direction.Horizontal : strip.side === 'left' || strip.side === 'right'}
        data-strip={keyOf(strip)}
        aria-label={`Drag to change the ${nameOf(strip)} (${valueOf(strip)} px)`}
        onpointerdown={(e) => begin(e, strip)}
        onpointermove={move}
        onpointerup={end}
        onpointercancel={end}
      ></button>
      <span class="value">{valueOf(strip)}</span>
    </div>
  {/each}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .band {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .band[data-inset='x'] {
    min-width: 16px;
  }

  .band[data-inset='y'] {
    min-height: 16px;
  }

  .band:has(.handle:hover),
  .band.active {
    background: color-mix(in oklab, var(--ui-accent) 22%, transparent);
  }

  .handle {
    flex: none;
    width: 12px;
    height: 4px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-accent);
    pointer-events: all;
    cursor: ns-resize;
    touch-action: none;
  }

  .handle.across {
    width: 4px;
    height: 12px;
    cursor: ew-resize;
  }

  .value {
    display: none;
    padding: 0 4px;
    border-radius: 9999px;
    background: var(--ui-accent);
    color: var(--ui-on-accent, var(--ui-bg));
    font-size: 10px;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
  }

  .band:has(.handle:hover) .value,
  .band.active .value {
    display: block;
  }
</style>
