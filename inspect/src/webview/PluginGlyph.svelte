<script lang="ts">
  import Puzzle from '@lucide/svelte/icons/puzzle';
  import { pixelCells } from '@feega/plugin-registry/pixel';

  const CELL = 2;

  let { pixels }: { pixels: readonly string[] | undefined } = $props();

  const width = $derived(pixels ? Math.max(...pixels.map((row) => row.length)) : 0);
</script>

<span class="glyph" data-testid="plugin-glyph" data-icon={pixels ? 'pixel' : 'fallback'}>
  {#if pixels}
    <svg width={width * CELL} height={pixels.length * CELL} viewBox={`0 0 ${width} ${pixels.length}`} shape-rendering="crispEdges" aria-hidden="true">
      {#each pixelCells(pixels) as cell (`${cell.x}-${cell.y}`)}<rect x={cell.x} y={cell.y} width="1" height="1" fill={cell.fill} />{/each}
    </svg>
  {:else}
    <Puzzle size={16} />
  {/if}
</span>

<style>
  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--ui-radius-md, 8px);
    background: color-mix(in srgb, var(--ui-accent, currentColor) 10%, var(--ui-panel));
    color: var(--ui-text-2);
  }
</style>
