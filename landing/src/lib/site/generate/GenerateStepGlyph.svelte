<script lang="ts">
  import Slab from '../iso/Slab.svelte';
  import GlyphFrame from '../iso/GlyphFrame.svelte';
  import { GenerateGlyph } from '.';
  import { INK, SHADES, onTop } from '../iso/iso';

  let { glyph }: { glyph: GenerateGlyph } = $props();

  const CANVAS = { x: 0, y: 0, w: 84, d: 60, t: 6 };
  const NODE = { w: 30, d: 22, t: 3 };
</script>

{#snippet tile(x: number, y: number)}
  <Slab box={{ x, y, w: 30, d: 22, t: 3 }} shade={SHADES.card}>
    <rect x="3" y="3" width="24" height="16" rx="1.5" fill="#bdb7ac" />
    <circle cx="21" cy="8" r="2.5" fill={INK.accent} />
  </Slab>
{/snippet}

<GlyphFrame name={glyph}>
  {#if glyph === GenerateGlyph.Prompt}
    <Slab box={CANVAS} shade={SHADES.night} />
    <g class="move" style:--to="translateY(-28px)">
      <Slab box={{ x: 10, y: 8, w: 64, d: 44, t: 4 }} shade={SHADES.paper}>
        <rect x="8" y="9" width="40" height="4" rx="1.5" fill={INK.light} />
        <rect x="8" y="17" width="30" height="4" rx="1.5" fill={INK.light} />
        <rect class="show" x="8" y="26" width="1.6" height="8" fill={INK.accent} />
      </Slab>
    </g>
  {:else if glyph === GenerateGlyph.Wire}
    <Slab box={CANVAS} shade={SHADES.night}>
      <path class="draw" d="M36 18C46 18 38 42 48 42" fill="none" stroke={INK.dark} stroke-width="1.4" stroke-linecap="round" pathLength="1" />
    </Slab>
    <g transform={onTop(0, 0, CANVAS.t)}>
      <g class="show"><circle cx="48" cy="42" r="2.4" fill={INK.accent} /></g>
    </g>
    <g transform="translate(0 -{CANVAS.t})">
      <Slab box={{ x: 6, y: 8, ...NODE }} shade={SHADES.card} />
      <Slab box={{ x: 48, y: 32, ...NODE }} shade={SHADES.card} />
    </g>
  {:else}
    <Slab box={CANVAS} shade={SHADES.night} />
    <g transform="translate(0 -{CANVAS.t})">
      {@render tile(12, 10)}
      {@render tile(42, 28)}
    </g>
    <g transform="translate(0 -{CANVAS.t + 30})">
      <g class="move" style:--to="translateY(27px)">
        <g class="show">{@render tile(46, 24)}</g>
      </g>
    </g>
  {/if}
</GlyphFrame>
