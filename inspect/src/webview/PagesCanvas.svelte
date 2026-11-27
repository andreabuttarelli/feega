<script lang="ts">
  import CanvasShell from './CanvasShell.svelte';
  import { CANVAS_COLUMNS, layoutCanvas, type CanvasFrame } from './canvas-layout';
  import { MIN_LIVE_WIDTH } from './canvas-live';
  import { openOf, type CanvasOpen } from './canvas-open';
  import ExampleField from './ExampleField.svelte';
  import type { PageRow } from './pages';
  import { SIZES } from './sizes';

  type Props = { rows: PageRow[]; base: string; onopen: (target: CanvasOpen) => void; onadd: (pattern: string, path: string) => void; onclose: () => void };

  let { rows, base, onopen, onadd, onclose }: Props = $props();

  const layout = $derived(layoutCanvas(rows, CANVAS_COLUMNS));
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
  minLiveWidth={MIN_LIVE_WIDTH}
  frameLabel={dimsOf}
  srcOf={(f) => (f.target === null ? null : new URL(f.target, base).toString())}
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
    <b>{frame.route}</b><span>{frame.dynamic ? 'Dynamic route' : dimsOf(frame)}</span>
    {#if frame.target === null}<div class="manual"><ExampleField pattern={frame.route} onadd={(path) => onadd(frame.route, path)} /></div>{/if}
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

  .manual {
    position: relative;
    z-index: 1;
    width: 60%;
    margin-top: calc(8px / var(--zoom));
    font-size: min(calc(13px / var(--zoom)), 120px);
  }

  .manual :global(.field) {
    font-size: inherit;
  }

  .manual :global(input) {
    height: 1.8em;
  }
</style>
