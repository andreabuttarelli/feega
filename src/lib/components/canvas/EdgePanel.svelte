<script lang="ts">
  import { EDGE_KIND_LABEL, WIRE_MODES, WIRE_MODE_LABEL, WIRE_MODE_LOOK, type CanvasEdgeKind, type FlowEdge, type WireMode } from '$lib/canvas-edges';

  let {
    edge,
    at,
    kinds,
    modes,
    deletable,
    onkind,
    onmode,
    ondelete,
    onclose
  }: {
    edge: FlowEdge;
    at: { x: number; y: number };
    kinds: CanvasEdgeKind[];
    modes: boolean;
    deletable: boolean;
    onkind: (kind: CanvasEdgeKind) => void;
    onmode: (mode: WireMode) => void;
    ondelete: () => void;
    onclose: () => void;
  } = $props();
</script>

<div class="gen-menu-veil" role="presentation" onclick={onclose}></div>
<div class="edge-panel" role="menu" tabindex="-1" style={`left:${at.x}px; top:${at.y}px`}>
  {#each kinds as kind (kind)}
    <button type="button" role="menuitemradio" aria-checked={kind === edge.kind} class:is-on={kind === edge.kind} onclick={() => onkind(kind)}>
      {EDGE_KIND_LABEL[kind]}
    </button>
  {/each}

  {#if modes}
    <div class="edge-panel-sep" role="separator"></div>
    {#each WIRE_MODES as mode (mode)}
      <button
        type="button"
        role="menuitemradio"
        aria-checked={(edge.mode ?? 'fixed') === mode}
        class:is-on={(edge.mode ?? 'fixed') === mode}
        onclick={() => onmode(mode)}
      >
        {#if WIRE_MODE_LOOK[mode].icon}
          {@const Icon = WIRE_MODE_LOOK[mode].icon}
          <Icon class="edge-mode-icon" data-testid="wire-mode-icon-{mode}" size={12} />
        {/if}
        {WIRE_MODE_LABEL[mode]}
      </button>
    {/each}
  {/if}

  {#if deletable}
    <button type="button" role="menuitem" class="edge-drop" onclick={ondelete}>Togli</button>
  {/if}
</div>

<style>
  .gen-menu-veil {
    position: fixed;
    inset: 0;
    z-index: 20;
  }

  .edge-panel {
    position: fixed;
    z-index: 21;
    display: flex;
    flex-direction: column;
    min-width: 128px;
    padding: 4px;
    border-radius: 10px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
  }
  .edge-panel button {
    padding: 6px 10px;
    font: inherit;
    font-size: 12.5px;
    text-align: left;
    color: var(--ink, #1d1d1f);
    background: none;
    border: none;
    border-radius: 7px;
    cursor: pointer;
  }
  .edge-panel button:hover,
  .edge-panel button:focus-visible {
    background: var(--paper-2, #f9f9f9);
  }
  .edge-panel button.is-on {
    color: var(--accent, #7c5cff);
  }
  .edge-panel button.edge-drop {
    margin-top: 3px;
    padding-top: 7px;
    border-top: 1px solid var(--line, #e5e5e5);
    border-radius: 0;
    color: #c0392b;
  }
  .edge-panel :global(.edge-mode-icon) {
    color: var(--ui-wire-iterate);
    vertical-align: -2px;
    margin-right: 4px;
  }

  .edge-panel-sep {
    margin: 3px 0;
    border-top: 1px solid var(--line, #e5e5e5);
  }
</style>
