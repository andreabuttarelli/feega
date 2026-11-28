<script lang="ts">
  import type { ComponentRow } from '../host/component-list';
  import CanvasShell from './CanvasShell.svelte';
  import { CardState, badgeOf } from './canvas-card';
  import { ROW_WIDTH, layoutFlow, type CellSize, type FlowFrame } from './canvas-layout';
  import { componentKeysOf } from './canvas-stale';
  import { keyOfComponent } from './components';
  import type { FilesChange } from './files-change';
  import { mountUrlOf } from './component-mount';

  type Props = { rows: ComponentRow[]; base: string; onopen: (row: ComponentRow) => void; onclose: () => void; changed: FilesChange | null };

  let { rows, base, onopen, onclose, changed }: Props = $props();

  const ALWAYS_LIVE_WIDTH = 0;
  const LIVE_FRAMES = 40;
  const LOADING_TEXT = 'Rendering…';
  const FAILED_TEXT = 'Needs props';

  let sizes = $state<Record<string, CellSize>>({});
  let shown = $state<Record<string, Record<string, unknown>>>({});

  const byKey = $derived(new Map(rows.map((row) => [keyOfComponent(row), row])));
  const layout = $derived(layoutFlow(rows.map((row) => ({ key: keyOfComponent(row), name: row.name, size: sizes[keyOfComponent(row)] })), ROW_WIDTH));

  const stale = $derived(changed ? { keys: componentKeysOf(rows, changed.files) } : null);

  const rowOf = (frame: FlowFrame) => byKey.get(frame.key)!;

  function ready(key: string, report: { size: CellSize | null; props: Record<string, unknown> }) {
    shown[key] = report.props;
    if (report.size) {
      sizes[key] = report.size;
    }
  }
</script>

<CanvasShell
  frames={layout.frames}
  bounds={layout.bounds}
  label="Components canvas"
  testid="components-canvas"
  minLiveWidth={ALWAYS_LIVE_WIDTH}
  snug
  liveCap={LIVE_FRAMES}
  frameLabel={(f) => f.name}
  frameBadge={(f) => badgeOf(rowOf(f).sample, shown[f.key])}
  srcOf={(f) => mountUrlOf(base, rowOf(f))}
  hitOf={(f) => ({ label: `Open ${f.name}`, title: `Open ${f.name} on its own`, enabled: true })}
  onopen={(f) => onopen(rowOf(f))}
  onready={ready}
  {onclose}
  {stale}
>
  {#snippet card(_frame: FlowFrame, state: CardState, reason: string)}
    {#if state === CardState.Failed}
      <span class="note" title={reason}>{FAILED_TEXT}</span>
    {:else}
      <span class="note">{LOADING_TEXT}</span>
    {/if}
  {/snippet}
</CanvasShell>
