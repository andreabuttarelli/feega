<script lang="ts">
  import type { Gap } from '$lib/motion/scene-select';
  import type { SnapGuide } from '$lib/canvas/snap';

  let { gaps = [], guides = [], zoom }: { gaps?: Gap[]; guides?: SnapGuide[]; zoom: number } = $props();

  const LINE_PX = 1;

  const mid = (g: Gap) => (g.from + g.to) / 2;
</script>

<div class="measure" data-testid="measure-layer" style:--inverse={1 / zoom}>
  {#each guides as g (g.axis + g.at)}
    {#if g.axis === 'x'}
      <div class="line" data-testid="snap-guide" style:left="{g.at}px" style:top="{g.from}px" style:width="{LINE_PX / zoom}px" style:height="{g.to - g.from}px"></div>
    {:else}
      <div class="line" data-testid="snap-guide" style:left="{g.from}px" style:top="{g.at}px" style:width="{g.to - g.from}px" style:height="{LINE_PX / zoom}px"></div>
    {/if}
  {/each}
  {#each gaps as g (g.axis + g.from + g.to + g.at)}
    {#if g.axis === 'x'}
      <div class="line" style:left="{g.from}px" style:top="{g.at}px" style:width="{g.to - g.from}px" style:height="{LINE_PX / zoom}px"></div>
      <span class="label" data-testid="measure-label" style:left="{mid(g)}px" style:top="{g.at}px">{Math.round(g.to - g.from)}</span>
    {:else}
      <div class="line" style:left="{g.at}px" style:top="{g.from}px" style:width="{LINE_PX / zoom}px" style:height="{g.to - g.from}px"></div>
      <span class="label" data-testid="measure-label" style:left="{g.at}px" style:top="{mid(g)}px">{Math.round(g.to - g.from)}</span>
    {/if}
  {/each}
</div>

<style>
  .measure { position: absolute; inset: 0; pointer-events: none; z-index: 1001; }
  .line { position: absolute; background: #ff3d7f; }
  .label { position: absolute; transform: translate(-50%, -50%) scale(var(--inverse)); padding: 1px 4px; color: #fff; background: #ff3d7f; font-size: 11px; line-height: 14px; white-space: nowrap; border-radius: 2px; }
</style>
