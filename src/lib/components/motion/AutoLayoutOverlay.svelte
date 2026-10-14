<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { Box } from '$lib/motion/layout';
  import { StripKind, dragStrip, layoutStrips, type Pt, type Strip } from '$lib/motion/layout/guides';
  import { setAutoLayout } from '$lib/motion/layout/ops';
  import type { AutoLayout } from '$lib/motion/layout/model';
  import { Direction } from '$lib/motion/layout/auto-layout';

  let { doc, clip, onchange }: { doc: MotionDoc; clip: MotionClip & { autoLayout: AutoLayout }; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const SUMMARY: Record<StripKind, string> = {
    [StripKind.Padding]: 'Changed the padding',
    [StripKind.Gap]: 'Changed the gap'
  };

  let host = $state<HTMLDivElement | null>(null);
  let grab = $state<{ strip: Strip; from: Pt } | null>(null);
  let live = $state<Partial<AutoLayout> | null>(null);

  const shown = $derived.by(() => {
    const result = live ? setAutoLayout(doc, clip.id, live) : null;
    return result?.ok ? result.doc : doc;
  });
  const strips = $derived(layoutStrips(shown, clip.id));
  const layout = $derived(live ? { ...clip.autoLayout, ...live } : clip.autoLayout);

  const place = (b: Box) => `left: ${(b.left / doc.width) * 100}%; top: ${(b.top / doc.height) * 100}%; width: ${(b.width / doc.width) * 100}%; height: ${(b.height / doc.height) * 100}%;`;
  const valueOf = (strip: Strip) => (strip.kind === StripKind.Gap ? layout.gap : layout.padding[strip.side]);
  const keyOf = (strip: Strip) => (strip.kind === StripKind.Gap ? 'gap' : strip.side);
  const nameOf = (strip: Strip) => (strip.kind === StripKind.Gap ? 'gap' : `${strip.side} padding`);

  function local(e: PointerEvent): Pt {
    const rect = host!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * doc.width, ((e.clientY - rect.top) / rect.height) * doc.height];
  }

  function begin(e: PointerEvent, strip: Strip) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { strip, from: local(e) };
  }

  function move(e: PointerEvent) {
    if (!grab) {
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
    <button
      type="button"
      class="strip"
      class:across={strip.kind === StripKind.Gap ? layout.direction === Direction.Horizontal : strip.side === 'left' || strip.side === 'right'}
      class:active={grab && keyOf(grab.strip) === keyOf(strip)}
      data-strip={keyOf(strip)}
      aria-label={`Drag to change the ${nameOf(strip)} (${valueOf(strip)} px)`}
      style={place(strip.box)}
      onpointerdown={(e) => begin(e, strip)}
      onpointermove={move}
      onpointerup={end}
      onpointercancel={end}
    >
      <span class="value">{valueOf(strip)}</span>
    </button>
  {/each}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .strip {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: all;
    cursor: ns-resize;
  }

  .strip.across {
    cursor: ew-resize;
  }

  .strip:hover,
  .strip.active {
    background: color-mix(in oklab, var(--ui-accent) 22%, transparent);
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

  .strip:hover .value,
  .strip.active .value {
    display: block;
  }
</style>
