<script lang="ts">
  import type { Snippet } from 'svelte';
  import InspectorFields from './InspectorFields.svelte';
  import { SETTINGS_COLUMN } from '$lib/canvas/settings-column';
  import type { InspectorView } from '$lib/canvas/node-inspector';

  let {
    selected,
    view,
    shown,
    onfield,
    onsync,
    children
  }: {
    selected: boolean;
    view: InspectorView | null;
    shown: number;
    onfield: (data: Record<string, unknown>) => void;
    onsync: () => void;
    children: Snippet;
  } = $props();
</script>

<div class="source-frame" style={`--column-w:${SETTINGS_COLUMN.w}px;--column-h:${SETTINGS_COLUMN.h}px`}>
  <div class="source-preview">
    {@render children()}
  </div>

  {#if selected && view}
    <div class="source-settings nowheel nodrag nopan" data-testid="source-settings">
      <InspectorFields {view} {shown} {onfield} {onsync} />
    </div>
  {/if}
</div>

<style>
  .source-frame {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .source-preview {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
  }

  .source-settings {
    flex: 0 0 var(--column-w);
    min-height: 0;
    border: 1px solid var(--line, #e5e5e5);
    border-left: 0;
    cursor: default;
  }

  @media (max-width: 767px) {
    .source-frame {
      flex-direction: column;
    }

    .source-settings {
      flex-basis: var(--column-h);
      border-left: 1px solid var(--line, #e5e5e5);
      border-top: 0;
    }
  }
</style>
