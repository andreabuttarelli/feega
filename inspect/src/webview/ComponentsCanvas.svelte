<script lang="ts">
  import type { ComponentRow } from '../host/component-list';
  import CanvasShell from './CanvasShell.svelte';
  import { GRID_COLUMNS, layoutGrid, type GridFrame } from './canvas-layout';
  import { componentKeysOf } from './canvas-stale';
  import { keyOfComponent } from './components';
  import type { FilesChange } from './files-change';
  import { mountUrlOf } from './component-mount';

  type Props = { rows: ComponentRow[]; base: string; onopen: (row: ComponentRow) => void; onclose: () => void; changed: FilesChange | null };

  let { rows, base, onopen, onclose, changed }: Props = $props();

  const ALWAYS_LIVE_WIDTH = 0;

  const byKey = $derived(new Map(rows.map((row) => [keyOfComponent(row), row])));
  const layout = $derived(layoutGrid(rows.map((row) => ({ key: keyOfComponent(row), name: row.name })), GRID_COLUMNS));

  const stale = $derived(changed ? { keys: componentKeysOf(rows, changed.files) } : null);

  const rowOf = (frame: GridFrame) => byKey.get(frame.key)!;
</script>

<CanvasShell
  frames={layout.frames}
  bounds={layout.bounds}
  label="Components canvas"
  testid="components-canvas"
  minLiveWidth={ALWAYS_LIVE_WIDTH}
  frameLabel={(f) => f.name}
  srcOf={(f) => mountUrlOf(base, rowOf(f))}
  hitOf={(f) => ({ label: `Open ${f.name}`, title: `Open ${f.name} on its own`, enabled: true })}
  onopen={(f) => onopen(rowOf(f))}
  {onclose}
  {stale}
>
  {#snippet card(frame: GridFrame, cannotRender: boolean)}
    <b>{frame.name}</b><span>{cannotRender ? 'Needs props or context to render' : rowOf(frame).file}</span>
  {/snippet}
</CanvasShell>
