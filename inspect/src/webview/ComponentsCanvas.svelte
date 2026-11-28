<script lang="ts">
  import type { ComponentRow } from '../host/component-list';
  import CanvasShell from './CanvasShell.svelte';
  import { CardState, failedTextOf, type MountStatus } from './canvas-card';
  import { MAX_CELL, MIN_CELL, ROW_WIDTH, layoutFlow, type CellSize, type FlowFrame } from './canvas-layout';
  import { sessionSizes } from './canvas-session';
  import type { FrameSize } from './canvas-select';
  import { componentKeysOf } from './canvas-stale';
  import { keyOfComponent } from './components';
  import type { ExampleProps } from './component-props.svelte';
  import type { FilesChange } from './files-change';
  import { mountUrlOf } from './component-mount';
  import PropFields from './PropFields.svelte';

  type Props = { rows: ComponentRow[]; base: string; props: ExampleProps; onopen: (row: ComponentRow) => void; onclose: () => void; changed: FilesChange | null };

  let { rows, base, props, onopen, onclose, changed }: Props = $props();

  const ALWAYS_LIVE_WIDTH = 0;
  const LIVE_FRAMES = 40;
  const LOADING_TEXT = 'Rendering…';

  let sizes = $state<Record<string, CellSize>>({});
  let selected = $state<string | null>(null);
  let resized = $state<Record<string, FrameSize>>(Object.fromEntries(sessionSizes));

  const byKey = $derived(new Map(rows.map((row) => [keyOfComponent(row), row])));
  const layout = $derived(layoutFlow(rows.map((row) => ({ key: keyOfComponent(row), name: row.name, size: sizes[keyOfComponent(row)] })), ROW_WIDTH, resized));

  const stale = $derived(changed ? { keys: componentKeysOf(rows, changed.files) } : null);

  const rowOf = (frame: FlowFrame) => byKey.get(frame.key)!;

  function resize(key: string, size: FrameSize) {
    resized[key] = size;
    sessionSizes.set(key, size);
  }

  function status(key: string, report: MountStatus) {
    if (report.kind === 'controls') {
      props.controls[key] = report.controls;
    }
    if (report.kind !== 'ready') {
      return;
    }
    props.shown[key] = report.props;
    props.controls[key] = report.controls;
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
  reload={props.revision}
  frameLabel={(f) => f.name}
  frameBadge={(f) => props.badgeOf(rowOf(f))}
  srcOf={(f) => mountUrlOf(base, rowOf(f), props.propsOf(rowOf(f)))}
  liveSrcOf={(f) => mountUrlOf(base, rowOf(f), props.propsOf(rowOf(f)))}
  bind:selected
  onresize={resize}
  limits={{ min: MIN_CELL, max: MAX_CELL }}
  hitOf={(f) => ({ label: `Select ${f.name}`, title: `Select ${f.name}. Double-click to open it on its own`, enabled: true })}
  onopen={(f) => onopen(rowOf(f))}
  onstatus={status}
  {onclose}
  {stale}
>
  {#snippet card(frame: FlowFrame, state: CardState, reason: string)}
    {#if state === CardState.Failed}
      <span class="note" title={reason}>{failedTextOf(reason)}</span>
      {@const row = rowOf(frame)}
      {@const fields = props.fieldsOf(row)}
      {#if fields.length > 0}
        <div class="interactive"><PropFields {fields} onedit={(name, text, kind) => props.edit(row, name, text, kind)} /></div>
      {/if}
    {:else}
      <span class="note">{LOADING_TEXT}</span>
    {/if}
  {/snippet}
</CanvasShell>
