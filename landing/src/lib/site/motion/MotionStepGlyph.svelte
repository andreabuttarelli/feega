<script lang="ts">
  import Slab from '../iso/Slab.svelte';
  import GlyphFrame from '../iso/GlyphFrame.svelte';
  import { MotionGlyph } from '.';
  import { INK, SHADES } from '../iso/iso';

  let { glyph }: { glyph: MotionGlyph } = $props();

  const TIMELINE = { x: 0, y: 0, w: 84, d: 60, t: 6 };
  const LANES = [
    { y: 18, keys: [22, 58] },
    { y: 32, keys: [34, 66] },
    { y: 46, keys: [16, 46] }
  ];
</script>

{#snippet diamond(x: number, y: number, fill: string)}
  <rect x={x - 2.5} y={y - 2.5} width="5" height="5" transform="rotate(45 {x} {y})" {fill} />
{/snippet}

{#snippet timeline()}
  <Slab box={TIMELINE} shade={SHADES.code}>
    {#each LANES as lane, i (i)}
      <rect x="10" y={lane.y - 0.5} width="66" height="1" fill={INK.dark} opacity="0.18" />
      {#each lane.keys as x (x)}
        {@render diamond(x, lane.y, '#555')}
      {/each}
    {/each}
  </Slab>
{/snippet}

<GlyphFrame name={glyph}>
  {#if glyph === MotionGlyph.Key}
    <Slab box={TIMELINE} shade={SHADES.code}>
      {#each LANES as lane, i (i)}
        <rect x="10" y={lane.y - 0.5} width="66" height="1" fill={INK.dark} opacity="0.18" />
        {@render diamond(lane.keys[0], lane.y, '#555')}
      {/each}
      <g class="show">{@render diamond(58, 18, INK.accent)}</g>
    </Slab>
    <g transform="translate(0 -26)">
      <g class="move" style:--to="translate(17.32px, 10px)">
        <Slab box={{ x: 8, y: 6, w: 34, d: 22, t: 4 }} shade={SHADES.paper}>
          <rect x="6" y="6" width="18" height="4" rx="1.5" fill={INK.light} />
          <rect x="6" y="13" width="12" height="3" rx="1.5" fill={INK.light} opacity="0.5" />
        </Slab>
      </g>
    </g>
  {:else if glyph === MotionGlyph.Play}
    <Slab box={TIMELINE} shade={SHADES.code}>
      {#each LANES as lane, i (i)}
        <rect x="10" y={lane.y - 0.5} width="66" height="1" fill={INK.dark} opacity="0.18" />
        {#each lane.keys as x (x)}
          {@render diamond(x, lane.y, '#555')}
        {/each}
      {/each}
      <g class="move" style:--to="translateX(56px)">
        <path d="M7 3h6v4l-3 3l-3-3z" fill={INK.accent} />
        <rect x="9.4" y="9" width="1.2" height="46" fill={INK.accent} />
      </g>
    </Slab>
  {:else}
    {@render timeline()}
    <g class="move" style:--to="translateY(-26px)">
      <g class="show">
        <Slab box={{ x: 30, y: 26, w: 44, d: 28, t: 4 }} shade={SHADES.card}>
          <rect x="4" y="4" width="36" height="20" rx="1.5" fill={INK.light} />
          <path d="M19 9.5l7 4.5l-7 4.5z" fill={INK.accent} />
        </Slab>
      </g>
    </g>
  {/if}
</GlyphFrame>
