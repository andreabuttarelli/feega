<script lang="ts" module>
  import type { MeasuredBox } from '$lib/motion/hyperframes/measure';

  const measured = new Map<string, Record<string, MeasuredBox>>();
</script>

<script lang="ts">
  import PartsProbe from './PartsProbe.svelte';
  import { Pose } from '$lib/motion/hyperframes/measure';
  import { Gesture } from '$lib/motion/drill';
  import { closedHover, containFit } from '$lib/canvas/frame-hover';
  import { frameDrill, type FramePoint } from '$lib/canvas/frame-drill';
  import { layersSource } from '$lib/canvas/layers-source.svelte';

  let { nodeId, revision, previewUrl, width, height }: { nodeId: string; revision: number; previewUrl: string; width: number; height: number } = $props();

  const key = $derived(`${nodeId}:${revision}`);
  let boxes = $state.raw<Record<string, MeasuredBox> | null>(null);
  let probing = $state(false);
  let hovered = $state<string | null>(null);
  let host = $state<HTMLDivElement | null>(null);

  $effect(() => {
    boxes = measured.get(key) ?? null;
  });

  const shown = $derived(hovered ?? (layersSource.hovered?.nodeId === nodeId ? layersSource.hovered.id : null));
  const outline = $derived(shown && boxes ? (boxes[shown] ?? null) : null);

  function pointOf(e: MouseEvent): FramePoint | null {
    if (!host) {
      return null;
    }
    const r = host.getBoundingClientRect();
    const fit = containFit({ width: r.width, height: r.height }, { width, height });
    return { x: (e.clientX - r.left - fit.left) / fit.width, y: (e.clientY - r.top - fit.top) / fit.height };
  }

  const DWELL_MS = 200;
  let dwell: ReturnType<typeof setTimeout> | undefined;

  function enter(e: PointerEvent) {
    if (boxes || e.buttons || e.pointerType !== 'mouse') {
      return;
    }
    dwell = setTimeout(() => (probing = true), DWELL_MS);
  }

  function done(next: Record<string, MeasuredBox>) {
    probing = false;
    measured.set(key, next);
    boxes = next;
  }

  function move(e: PointerEvent) {
    const p = e.pointerType === 'mouse' && boxes ? pointOf(e) : null;
    const next = p ? closedHover(boxes!, p) : null;
    if (next === hovered) {
      return;
    }
    hovered = next;
    layersSource.hover(next ? { nodeId, id: next } : null);
  }

  function leave() {
    clearTimeout(dwell);
    if (hovered) {
      layersSource.hover(null);
    }
    hovered = null;
  }

  const DOUBLE_MS = 600;

  function press(e: PointerEvent) {
    const p = pointOf(e);
    if (!p) {
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) {
      frameDrill.request(nodeId, p, Gesture.Click);
      const upgrade = () => frameDrill.upgrade(nodeId, Gesture.Double);
      addEventListener('dblclick', upgrade, { capture: true, once: true });
      setTimeout(() => removeEventListener('dblclick', upgrade, { capture: true }), DOUBLE_MS);
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    frameDrill.request(nodeId, p, Gesture.Deep);
    layersSource.canvas?.open(nodeId);
  }

  function keepSelection(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      e.stopPropagation();
    }
  }

  function pct(b: MeasuredBox): string {
    const size = { width: host?.clientWidth ?? 0, height: host?.clientHeight ?? 0 };
    const fit = containFit(size, { width, height });
    const share = (n: number, of: number) => `${(n / Math.max(of, 1)) * 100}%`;
    return `left: ${share(fit.left + b.left * fit.width, size.width)}; top: ${share(fit.top + b.top * fit.height, size.height)}; width: ${share(b.width * fit.width, size.width)}; height: ${share(b.height * fit.height, size.height)};`;
  }
</script>

<div class="frame-hover" role="presentation" data-testid="frame-hover" bind:this={host} onpointerenter={enter} onpointermove={move} onpointerleave={leave} onpointerdowncapture={press} onclickcapture={keepSelection}>
  {#if outline}<div class="outline" data-testid="frame-hover-box" data-hovered={shown} style={pct(outline)}></div>{/if}
</div>
{#if probing}
  <PartsProbe url={`${previewUrl}?revision=${revision}`} pose={Pose.Posed} onmeasured={done} />
{/if}

<style>
  .frame-hover {
    position: absolute;
    inset: 0;
  }

  .outline {
    position: absolute;
    border: 1px solid var(--ui-hover-outline, var(--ui-accent));
    pointer-events: none;
  }
</style>
