<script lang="ts">
  import type { Tile } from '../CanvasFlow.svelte';
  import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
  import { NODE_KIND_ICON, NODE_KIND_LABEL, NameTag } from '$lib/canvas/node-label';
  import { isNodeType } from '$lib/canvas/node-data';
  import { dragAngle } from '$lib/canvas/node-layout';

  let { tile, selected, onrotate }: { tile: Tile; selected: boolean; onrotate?: (id: string, degrees: number) => void } = $props();

  const SNAP_DEG = 15;
  const spaced = (i: number, n: number) => `${((i + 1) / (n + 1)) * 100}%`;
  const kind = $derived(tile.kind && isNodeType(tile.kind) ? tile.kind : null);
  const Icon = $derived(kind ? NODE_KIND_ICON[kind] : null);
  const label = $derived(tile.tag === NameTag.Hidden ? null : tile.displayName?.trim() || (kind ? NODE_KIND_LABEL[kind] : null));
  const ports = $derived(tile.connectable === false ? [] : (tile.connectors ?? []));
  const outputs = $derived(tile.connectable === false ? [] : (tile.outputs ?? []));

  function startRotate(e: PointerEvent) {
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const box = handle.closest('.svelte-flow__node')!.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const from = { x: e.clientX, y: e.clientY };
    handle.setPointerCapture(e.pointerId);
    handle.onpointerup = (up) => {
      handle.onpointerup = null;
      const degrees = dragAngle(centre, from, { x: up.clientX, y: up.clientY }, up.shiftKey ? SNAP_DEG : 0);
      if (degrees) {
        onrotate?.(tile.id, degrees);
      }
    };
  }
</script>

{#if label && Icon}
  <div class="node-label" class:is-chosen={selected}>
    <Icon size={12} strokeWidth={1.8} />
    <span>{label}</span>
    {#if tile.inPost}
      <span class="in-post-marker" title="Used in a post">●</span>
    {/if}
  </div>
{/if}

{#each ports as connector, i (connector)}
  <div class="svelte-flow__handle typed-port port-in target" data-handleid={connector} data-nodeid={tile.id} style={`top:${spaced(i, ports.length)};--port:${CONNECTOR_STYLE[connector].color}`} title={CONNECTOR_STYLE[connector].label} aria-label={CONNECTOR_STYLE[connector].label}></div>
  <span class="port-name port-name-in" style={`top:${spaced(i, ports.length)};--port:${CONNECTOR_STYLE[connector].color}`}>{CONNECTOR_STYLE[connector].label}</span>
{/each}

{#if tile.connectable !== false && tile.output}
  <div class="svelte-flow__handle typed-port port-out source" data-nodeid={tile.id} style={`top:50%;--port:${CONNECTOR_STYLE[tile.output].color}`} title={CONNECTOR_STYLE[tile.output].label} aria-label={CONNECTOR_STYLE[tile.output].label}></div>
  <span class="port-name port-name-out" style={`top:50%;--port:${CONNECTOR_STYLE[tile.output].color}`}>{CONNECTOR_STYLE[tile.output].label}</span>
{/if}

{#each outputs as out, i (out.handle)}
  <div class="svelte-flow__handle typed-port port-out source" data-handleid={out.handle} data-nodeid={tile.id} style={`top:${spaced(i, outputs.length)};--port:${CONNECTOR_STYLE[out.port].color}`} title={out.label} aria-label={out.label}></div>
  <span class={`port-name port-name-out ${out.incompatible ? 'port-name-flagged' : ''}`} style={`top:${spaced(i, outputs.length)};--port:${CONNECTOR_STYLE[out.port].color}`}>{out.label}</span>
{/each}

{#if selected && tile.rotatable && onrotate}
  <button type="button" class="rotate-handle nodrag nopan" aria-label="Rotate" data-testid="rotate-handle" onpointerdown={startRotate}></button>
{/if}

<style>
  .port-name {
    position: absolute;
    transform: translateY(-50%);
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    font-size: 11px;
    line-height: 1;
    font-weight: 600;
    white-space: nowrap;
    color: var(--port);
    pointer-events: none;
    transition: opacity 120ms ease;
  }
  .port-name-in {
    right: calc(100% + 16px);
  }
  .port-name-out {
    left: calc(100% + 16px);
  }
  .port-name-flagged {
    opacity: 0.5;
    text-decoration: line-through;
  }
  :global(.svelte-flow__node.selected .typed-port) + .port-name {
    max-width: none;
    opacity: 1;
  }
  @media (hover: hover) {
    :global(.svelte-flow__node:hover .typed-port) + .port-name,
    :global(.typed-port:hover) + .port-name {
      max-width: none;
      opacity: 1;
    }
  }

  .node-label {
    position: absolute;
    z-index: 3;
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    padding: 2px 0;
    font-size: var(--canvas-label-size);
    line-height: 1.3;
    color: var(--ink-soft, #6e6e73);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node-label :global(svg) {
    flex: none;
  }
  .node-label span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .in-post-marker {
    flex: none;
    font-size: 8px;
    line-height: 1;
    color: var(--accent, #2563eb);
  }
  .node-label.is-chosen {
    color: var(--ink, #1d1d1f);
  }

  .rotate-handle {
    position: absolute;
    left: 50%;
    top: -28px;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    padding: 0;
    border: 2px solid var(--accent, #7c5cff);
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel-raised, #fff);
    cursor: grab;
    z-index: 5;
  }
</style>
