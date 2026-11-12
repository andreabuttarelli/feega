<script lang="ts">
  import Slab from '../iso/Slab.svelte';
  import GlyphFrame from '../iso/GlyphFrame.svelte';
  import { Glyph } from '.';
  import { INK, SHADES, onTop } from '../iso/iso';

  let { glyph }: { glyph: Glyph } = $props();

  const LINES = [
    [0, 44],
    [8, 30],
    [8, 38],
    [0, 22]
  ];
  const CODE = { x: 0, y: 0, w: 84, d: 60, t: 6 };
</script>

{#snippet code()}
  <Slab box={CODE} shade={SHADES.code}>
    {#each LINES as [indent, width], i (i)}
      <rect x={10 + indent} y={12 + i * 10} {width} height="2.5" rx="1.25" fill={INK.dark} opacity="0.35" />
    {/each}
  </Slab>
{/snippet}

<GlyphFrame name={glyph}>
  {#if glyph === Glyph.Import}
    {@render code()}
    <g class="move" style:--to="translateY(-30px)">
      <Slab box={{ x: 10, y: 8, w: 64, d: 44, t: 4 }} shade={SHADES.paper}>
        <circle cx="8" cy="8" r="2.5" fill={INK.accent} />
        <rect x="8" y="18" width="36" height="5" rx="1.5" fill={INK.light} />
        <rect x="8" y="27" width="24" height="5" rx="1.5" fill={INK.light} />
      </Slab>
    </g>
  {:else if glyph === Glyph.Edit}
    <Slab box={{ x: 0, y: 0, w: 84, d: 60, t: 5 }} shade={SHADES.paper}>
      <rect x="10" y="10" width="40" height="5" rx="1.5" fill={INK.light} />
      <rect x="10" y="19" width="28" height="5" rx="1.5" fill={INK.light} />
    </Slab>
    <g transform="translate(0 -5)">
      <g class="move" style:--to="translate(17.32px, 10px)">
        <Slab box={{ x: 10, y: 32, w: 30, d: 18, t: 4 }} shade={SHADES.accent} />
        <g class="select">
          <Slab box={{ x: 7, y: 29, w: 36, d: 24, t: 4 }} shade={{ top: 'none', left: 'none', right: 'none', line: INK.accent }} />
        </g>
      </g>
    </g>
  {:else}
    {@render code()}
    <g class="show" transform={onTop(0, 0, CODE.t)}>
      <rect x="6" y="38" width="72" height="8" rx="1.5" fill={INK.accent} opacity="0.2" />
      <rect x="10" y="41" width="40" height="2.5" rx="1.25" fill={INK.accent} />
    </g>
    <g class="move" style:--to="translateY(-22px)">
      <g class="show">
        <Slab box={{ x: 34, y: 34, w: 40, d: 20, t: 4 }} shade={SHADES.accent}>
          <path d="M9 10.5l3 3 6-7" fill="none" stroke={INK.dark} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          <rect x="22" y="8.5" width="12" height="2.5" rx="1.25" fill={INK.dark} />
        </Slab>
      </g>
    </g>
  {/if}
</GlyphFrame>
