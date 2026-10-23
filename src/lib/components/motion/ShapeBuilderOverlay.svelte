<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import { hostFraction } from '$lib/motion/overlay-point';
  import { pathData, polyline, type Pt } from '$lib/motion/shape/geometry';
  import { buildShapes, regionAt, shapeRegions } from '$lib/motion/shape/shape-builder';
  import type { OpResult } from '$lib/motion/timeline';

  let {
    doc,
    frame,
    picks,
    onchange,
    onexit
  }: {
    doc: MotionDoc;
    frame: number;
    picks: string[];
    onchange: (result: OpResult, summary: string) => void;
    onexit: () => void;
  } = $props();

  const SUMMARY = 'Built shapes';

  let host = $state<HTMLDivElement | null>(null);
  let hover = $state<string | null>(null);
  let merge = $state.raw<string[]>([]);
  let cut = $state.raw<string[]>([]);

  const regions = $derived(shapeRegions(doc, picks, frame));
  const outlineOf = (polygons: Pt[][]) => pathData(polygons.map((p) => polyline(p, true)));
  const toggled = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function at(e: PointerEvent) {
    const p = hostFraction(e, host!);
    return regionAt(regions, [p.x * doc.width, p.y * doc.height]);
  }

  function track(e: PointerEvent) {
    hover = at(e)?.id ?? null;
  }

  function pick(e: PointerEvent) {
    e.stopPropagation();
    const region = at(e);
    if (!region) {
      return;
    }
    if (e.altKey) {
      cut = toggled(cut, region.id);
      merge = merge.filter((id) => id !== region.id);
      return;
    }
    merge = toggled(merge, region.id);
    cut = cut.filter((id) => id !== region.id);
  }

  function apply() {
    const picked = { merge, cut };
    merge = [];
    cut = [];
    onchange(buildShapes(doc, picks, frame, picked, () => crypto.randomUUID().slice(0, 8)), SUMMARY);
    onexit();
  }

  function key(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== 'Escape') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (merge.length) {
      apply();
      return;
    }
    onexit();
  }

  const stateOf = (id: string) => (merge.includes(id) ? 'merge' : cut.includes(id) ? 'cut' : hover === id ? 'hover' : 'rest');
</script>

<svelte:window onkeydowncapture={key} />

<div class="builder" bind:this={host} data-testid="shape-builder-overlay" role="presentation" onpointerdown={pick} onpointermove={track} onpointerleave={() => (hover = null)}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#each regions as region (region.id)}
      <path class="region" data-state={stateOf(region.id)} data-members={region.members.join('+')} d={outlineOf(region.polygons)} fill-rule="evenodd" />
    {/each}
  </svg>
</div>

<style>
  .builder {
    position: absolute;
    inset: 0;
    z-index: 3;
    cursor: crosshair;
    pointer-events: auto;
    touch-action: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .region {
    fill: transparent;
    stroke: var(--ui-accent);
    stroke-width: 1px;
    stroke-opacity: 0.5;
    vector-effect: non-scaling-stroke;
  }

  .region[data-state='hover'] {
    fill: color-mix(in srgb, var(--ui-accent) 20%, transparent);
    stroke-opacity: 1;
  }

  .region[data-state='merge'] {
    fill: color-mix(in srgb, var(--ui-accent) 45%, transparent);
    stroke-opacity: 1;
  }

  .region[data-state='cut'] {
    fill: color-mix(in srgb, #e5484d 40%, transparent);
    stroke: #e5484d;
    stroke-opacity: 1;
  }
</style>
