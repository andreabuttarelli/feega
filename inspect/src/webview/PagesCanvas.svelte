<script lang="ts">
  import CanvasShell from './CanvasShell.svelte';
  import { untrack } from 'svelte';
  import { capturer } from './canvas-capture';
  import { CANVAS_COLUMNS, layoutCanvas, type CanvasFrame } from './canvas-layout';
  import { openOf, type CanvasOpen } from './canvas-open';
  import { sessionSnaps } from './canvas-session';
  import { SNAP_CONCURRENCY, snapQueue, type SnapJob } from './canvas-snaps';
  import { pageKeysOf } from './canvas-stale';
  import type { CanvasView, Viewport } from './canvas-view';
  import ExampleField from './ExampleField.svelte';
  import type { FilesChange } from './files-change';
  import type { PageRow } from './pages';
  import { SIZES } from './sizes';

  type Props = { rows: PageRow[]; base: string; onopen: (target: CanvasOpen) => void; onadd: (pattern: string, path: string) => void; onclose: () => void; changed: FilesChange | null };

  let { rows, base, onopen, onadd, onclose, changed }: Props = $props();

  let snaps = $state<Record<string, { url: string; capped: boolean; height: number }>>({});
  let unrendered = $state<string[]>([]);
  let view = $state<CanvasView>({ scale: 1, x: 0, y: 0 });
  let viewport = $state<Viewport>({ w: 0, h: 0 });

  const queue = snapQueue({ max: SNAP_CONCURRENCY, store: sessionSnaps, capture: (job) => capturer(base)(job), changed: publish });

  function publish() {
    snaps = Object.fromEntries(queue.snaps);
    unrendered = [...queue.failed];
  }

  publish();

  const heights = $derived(Object.fromEntries(Object.entries(snaps).filter(([, snap]) => snap.height > 0).map(([key, snap]) => [key, snap.height])));
  const layout = $derived(layoutCanvas(rows, CANVAS_COLUMNS, heights));

  const jobOf = (f: CanvasFrame): SnapJob => ({ key: f.key, target: f.target!, x: f.x, y: f.y, width: f.width, height: f.height, device: { w: SIZES[f.size].width ?? f.width, h: SIZES[f.size].height ?? f.height } });

  $effect(() => {
    queue.want(layout.frames.filter((f) => f.target !== null).map(jobOf), view, viewport);
  });

  let seen = untrack(() => changed);

  $effect(() => {
    if (changed && changed !== seen) {
      seen = changed;
      queue.invalidate(pageKeysOf(layout.frames, changed.files));
    }
  });

  $effect(() => () => queue.want([], view, viewport));

  const watch = (next: CanvasView, size: Viewport) => ((view = next), (viewport = size));
  const currentRoute = $derived(rows.find((r) => r.current)?.route ?? null);

  const dimsOf = (f: CanvasFrame) => `${SIZES[f.size].label} · ${f.width} × ${f.height}`;

  const hitOf = (f: CanvasFrame) => ({
    label: `Open ${f.target ?? f.route} at ${SIZES[f.size].label}`,
    title: f.target === null ? 'Dynamic route: type a value to open it' : `Open ${f.target} at ${SIZES[f.size].label}`,
    enabled: f.target !== null
  });

  function open(frame: CanvasFrame) {
    const target = openOf(frame);
    if (target) {
      onopen(target);
    }
  }
</script>

<CanvasShell
  frames={layout.frames}
  bounds={layout.bounds}
  label="Pages canvas"
  testid="pages-canvas"
  frameLabel={dimsOf}
  snapshots={snaps}
  {unrendered}
  onview={watch}
  {hitOf}
  onopen={open}
  {onclose}
>
  {#snippet world()}
    {#each layout.rows as row (row.route)}
      <h2 class="row-label" class:on={row.route === currentRoute} style={`left:0;top:${row.y}px`} data-testid="canvas-row">{row.route}{#if row.dynamic}<span class="tag" data-testid="canvas-example">{row.example?.label ?? 'dynamic'}</span>{/if}</h2>
    {/each}
  {/snippet}
  {#snippet card(frame: CanvasFrame)}
    <b>{frame.route}</b><span>{frame.target === null ? 'Dynamic route' : dimsOf(frame)}</span>
    {#if frame.target === null}<div class="manual"><ExampleField pattern={frame.route} onadd={(path) => onadd(frame.route, path)} /></div>{/if}
  {/snippet}
</CanvasShell>

<style>
  .row-label {
    position: absolute;
    margin: 0;
    color: var(--ui-text-2);
    font-size: calc(var(--label) * 1.15);
    line-height: 1.25;
    font-weight: 500;
    white-space: nowrap;
  }

  .row-label.on {
    color: var(--ui-text);
  }

  .tag {
    margin-left: 0.6em;
    padding: 0 0.5em;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-size: 0.8em;
    font-weight: 400;
  }

  .manual {
    position: relative;
    z-index: 1;
    width: 60%;
    margin-top: calc(8px / var(--zoom));
    font-size: min(calc(13px / var(--zoom)), 5cqw);
  }

  .manual :global(.field) {
    font-size: inherit;
  }

  .manual :global(input) {
    height: 1.8em;
  }
</style>
