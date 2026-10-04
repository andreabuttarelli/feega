<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { pivotOf } from '$lib/motion/parent';
  import { pathAt, pathHandles, type PathHandle } from '$lib/motion/path';
  import { setPathTangent } from '$lib/motion/path-ops';
  import { KeyEnd as Side } from '$lib/motion/graph';

  let { doc, clip, frame, onchange }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const MIRROR: Record<Side, Side> = { [Side.In]: Side.Out, [Side.Out]: Side.In };

  type Drag = { index: number; side: Side; x: number; y: number; start: PathHandle };

  let host = $state<HTMLDivElement | null>(null);
  let drag = $state<Drag | null>(null);
  let live = $state<MotionClip | null>(null);

  const size = $derived({ width: doc.width, height: doc.height });
  const shown = $derived(live ?? clip);
  const pivot = $derived(pivotOf(shown, size));
  const handles = $derived(pathHandles(shown, size) ?? []);
  const trail = $derived(sampled());
  const here = $derived(pathAt(shown, frame - shown.from, size));

  function sampled(): [number, number][] {
    const x = shown.keyframes.x ?? [];
    if (x.length < 2) {
      return [];
    }
    const first = x[0].frame;
    return Array.from({ length: x[x.length - 1].frame - first + 1 }, (_, i) => pathAt(shown, first + i, size)).flatMap((p) => (p ? [[p.x, p.y] as [number, number]] : []));
  }

  const screen = (p: [number, number]) => ({ x: pivot[0] + p[0] * size.width, y: pivot[1] + p[1] * size.height });
  const pct = (p: { x: number; y: number }) => `left: ${(p.x / size.width) * 100}%; top: ${(p.y / size.height) * 100}%;`;
  const tip = (h: PathHandle, side: Side) => screen([h.point[0] + h[side][0], h.point[1] + h[side][1]]);

  function start(e: PointerEvent, index: number, side: Side) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { index, side, x: e.clientX, y: e.clientY, start: handles[index] };
  }

  function tangentFor(d: Drag, e: PointerEvent) {
    const rect = host!.getBoundingClientRect();
    const moved: [number, number] = [d.start[d.side][0] + (e.clientX - d.x) / rect.width, d.start[d.side][1] + (e.clientY - d.y) / rect.height];
    const mirrored: [number, number] = [-moved[0], -moved[1]];
    return { frame: d.start.frame, [d.side]: moved, [MIRROR[d.side]]: mirrored } as { frame: number; in: [number, number]; out: [number, number] };
  }

  function move(e: PointerEvent) {
    if (!drag) {
      return;
    }
    const result = setPathTangent(doc, clip.id, tangentFor(drag, e));
    if (result.ok) {
      live = result.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.id) as MotionClip;
    }
  }

  function end(e: PointerEvent) {
    const done = drag;
    drag = null;
    live = null;
    if (!done) {
      return;
    }
    const result = setPathTangent(doc, clip.id, tangentFor(done, e));
    if (result.ok) {
      onchange(result.doc, 'Bent the motion path');
    }
  }
</script>

{#if trail.length}
  <div class="overlay" bind:this={host} data-testid="path-overlay" role="presentation" onpointermove={move} onpointerup={end} onpointercancel={end}>
    <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline class="trail" points={trail.map((p) => screen(p)).map((p) => `${p.x},${p.y}`).join(' ')} />
      {#each trail as p, i (i)}
        {@const s = screen(p)}
        <rect class="tick" x={s.x - 2} y={s.y - 2} width="4" height="4" />
      {/each}
      {#each handles as h (h.frame)}
        {@const at = screen(h.point)}
        {#each [Side.In, Side.Out] as side (side)}
          {@const t = tip(h, side)}
          <line class="arm" x1={at.x} y1={at.y} x2={t.x} y2={t.y} />
        {/each}
      {/each}
    </svg>
    {#each handles as h, i (h.frame)}
      <span class="key" style={pct(screen(h.point))} data-path-key={h.frame}></span>
      {#each [Side.In, Side.Out] as side (side)}
        <button type="button" class="handle" aria-label={`Path ${side} handle at frame ${h.frame}`} data-path-handle={`${h.frame}:${side}`} style={pct(tip(h, side))} onpointerdown={(e) => start(e, i, side)}></button>
      {/each}
    {/each}
    {#if here}<span class="now" style={pct(screen([here.x, here.y]))}></span>{/if}
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .trail {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .tick {
    fill: var(--ui-accent);
    opacity: 0.5;
  }

  .arm {
    stroke: var(--ui-accent);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  .key,
  .now,
  button {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  .key {
    width: 10px;
    height: 10px;
    background: var(--ui-accent);
    border: 1.5px solid #fff;
  }

  .now {
    width: 6px;
    height: 6px;
    background: #fff;
    outline: 1.5px solid var(--ui-accent);
  }

  .handle {
    width: 9px;
    height: 9px;
    padding: 0;
    pointer-events: all;
    background: #fff;
    border: 1.5px solid var(--ui-accent);
    cursor: move;
  }
</style>
