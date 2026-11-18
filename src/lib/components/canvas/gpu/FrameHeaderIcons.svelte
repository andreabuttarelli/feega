<script lang="ts">
  import Hint from '$lib/components/ui/shell/Hint.svelte';
  import { headerRow, type HeaderHit } from '$lib/canvas/core/frame-header';

  type View = { x: number; y: number; zoom: number };

  let { view, hits, onpress }: { view: View; hits: HeaderHit[]; onpress: (hit: HeaderHit) => void } = $props();

  const place = (h: HeaderHit) => `left:${view.x + h.x * view.zoom}px;top:${view.y + h.y * view.zoom}px;width:${h.w * view.zoom}px;height:${h.h * view.zoom}px`;
</script>

{#each hits as hit (`${hit.id}:${hit.key}`)}
  <Hint label={headerRow(hit.key).tooltip}>
    {#snippet children(trigger)}
      <button {...trigger} type="button" class="frame-header-icon" data-testid="frame-header-icon" data-badge={hit.key} data-node={hit.id} aria-label={headerRow(hit.key).tooltip} style={place(hit)} onpointerdown={(e) => e.stopPropagation()} onclick={() => onpress(hit)}></button>
    {/snippet}
  </Hint>
{/each}

<style>
  .frame-header-icon {
    position: absolute;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    pointer-events: auto;
  }
  .frame-header-icon:hover {
    background: var(--ui-wash);
  }
</style>
