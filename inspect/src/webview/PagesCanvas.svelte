<script lang="ts">
  import CanvasShell from './CanvasShell.svelte';
  import { CANVAS_COLUMNS, layoutCanvas, type CanvasFrame } from './canvas-layout';
  import { MIN_LIVE_WIDTH } from './canvas-live';
  import { openOf, type CanvasOpen } from './canvas-open';
  import { pageKeysOf } from './canvas-stale';
  import type { FilesChange } from './files-change';
  import type { PageRow } from './pages';
  import { SIZES } from './sizes';

  type Props = { rows: PageRow[]; base: string; onopen: (target: CanvasOpen) => void; onclose: () => void; changed: FilesChange | null };

  let { rows, base, onopen, onclose, changed }: Props = $props();

  const layout = $derived(layoutCanvas(rows, CANVAS_COLUMNS));
  const stale = $derived(changed ? { keys: pageKeysOf(layout.frames, changed.files) } : null);
  const currentRoute = $derived(rows.find((r) => r.current)?.route ?? null);

  const dimsOf = (f: CanvasFrame) => `${SIZES[f.size].label} · ${f.width} × ${f.height}`;

  const hitOf = (f: CanvasFrame) => ({
    label: `Open ${f.route} at ${SIZES[f.size].label}`,
    title: f.dynamic ? 'Dynamic route: open it from a link in the preview' : `Open ${f.route} at ${SIZES[f.size].label}`,
    enabled: !f.dynamic
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
  minLiveWidth={MIN_LIVE_WIDTH}
  frameLabel={dimsOf}
  srcOf={(f) => new URL(f.route, base).toString()}
  {hitOf}
  onopen={open}
  {onclose}
  {stale}
>
  {#snippet world()}
    {#each layout.rows as row (row.route)}
      <h2 class="row-label" class:on={row.route === currentRoute} style={`left:0;top:${row.y}px`} data-testid="canvas-row">{row.route}{#if row.dynamic}<span class="tag">dynamic</span>{/if}</h2>
    {/each}
  {/snippet}
  {#snippet card(frame: CanvasFrame)}
    <b>{frame.route}</b><span>{frame.dynamic ? 'Dynamic route' : dimsOf(frame)}</span>
  {/snippet}
</CanvasShell>

<style>
  .row-label {
    position: absolute;
    margin: 0;
    color: var(--ui-text-2);
    font-size: calc(var(--label) * 1.15);
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
</style>
