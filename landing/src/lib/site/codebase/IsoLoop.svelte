<script lang="ts">
  import Slab from '../iso/Slab.svelte';
  import { inView } from '../iso/in-view';
  import { INK, SHADES, onTop, type Shade } from '../iso/iso';

  type Theme = { page: Shade; card: Shade; ink: string; image: string; track: string };

  const LIGHT: Theme = { page: SHADES.paper, card: SHADES.card, ink: INK.light, image: '#dcd7cd', track: '#cfcac1' };
  const DARK: Theme = { page: SHADES.night, card: SHADES.nightCard, ink: INK.dark, image: '#3a3a3a', track: '#3a3a3a' };

  const TREE = [36, 28, 40, 24, 32, 28, 36, 22];
  const CODE = [
    [0, 120],
    [12, 70],
    [12, 96],
    [24, 58],
    [24, 84],
    [12, 40],
    [12, 110],
    [24, 66],
    [12, 50],
    [0, 30]
  ];
  const TOKEN_ROW = 2;
    const ROW = 14;
  const FIRST_ROW = 26;
  const CODE_X = 76;
  const CARDS = [40, 134];
</script>

{#snippet page(theme: Theme)}
  <Slab box={{ x: 20, y: 20, w: 220, d: 140, t: 5 }} shade={theme.page}>
    <circle cx="14" cy="12" r="4" fill={INK.accent} />
    {#each [150, 172, 194] as x (x)}
      <rect {x} y="10" width="16" height="3" rx="1.5" fill={theme.ink} opacity="0.5" />
    {/each}
  </Slab>
{/snippet}

{#snippet hero(theme: Theme)}
  <Slab box={{ x: 40, y: 40, w: 180, d: 54, t: 4 }} shade={theme.card}>
    <rect x="14" y="12" width="104" height="8" rx="2" fill={theme.ink} />
    <rect x="14" y="24" width="72" height="8" rx="2" fill={theme.ink} />
    <rect x="14" y="38" width="88" height="3" rx="1.5" fill={theme.ink} opacity="0.45" />
  </Slab>
  <g transform="translate(0 -4)">
    <Slab box={{ x: 170, y: 72, w: 38, d: 12, t: 3 }} shade={SHADES.accent} />
  </g>
{/snippet}

{#snippet cards(theme: Theme)}
  {#each CARDS as x (x)}
    <Slab box={{ x, y: 106, w: 86, d: 44, t: 4 }} shade={theme.card}>
      <rect x="8" y="8" width="30" height="28" rx="2" fill={theme.image} />
      <rect x="46" y="10" width="32" height="4" rx="2" fill={theme.ink} />
      <rect x="46" y="19" width="22" height="3" rx="1.5" fill={theme.ink} opacity="0.45" />
    </Slab>
  {/each}
{/snippet}

{#snippet toggle(theme: Theme)}
  <Slab box={{ x: 300, y: 34, w: 44, d: 44, t: 6 }} shade={theme.page}>
    <rect x="8" y="16" width="28" height="12" rx="6" fill={theme.track} />
  </Slab>
{/snippet}

<svg class="loop" viewBox="-165 -122 445 352" role="img" aria-label="Code becomes editable design layers, a theme change ripples through them, and they fold back into the code as a pull request" use:inView>
  <Slab box={{ x: 0, y: 0, w: 260, d: 180, t: 8 }} shade={SHADES.code}>
    {#each [10, 18, 26] as cx (cx)}
      <circle {cx} cy="10" r="2.5" fill="#333" />
    {/each}
    <rect x="6" y={FIRST_ROW + ROW * 2 - 4} width="52" height="11" rx="2" fill={INK.accent} opacity="0.14" />
    {#each TREE as width, i (i)}
      <rect x={i % 3 ? 18 : 10} y={FIRST_ROW + ROW * i} {width} height="3" rx="1.5" fill={INK.dark} opacity="0.28" />
    {/each}
    <line x1="64" y1="20" x2="64" y2="170" stroke="#262626" stroke-width="0.8" />
    {#each CODE as [indent, width], i (i)}
      {#if i === TOKEN_ROW}
        <rect x={CODE_X + indent} y={FIRST_ROW + ROW * i} width="44" height="3" rx="1.5" fill={INK.accent} opacity="0.9" />
        <rect x={CODE_X + indent + 50} y={FIRST_ROW + ROW * i} width={width - 50} height="3" rx="1.5" fill={INK.dark} opacity="0.35" />
      {:else}
        <rect x={CODE_X + indent} y={FIRST_ROW + ROW * i} {width} height="3" rx="1.5" fill={INK.dark} opacity="0.35" />
      {/if}
    {/each}
    <g class="ship" style:--z="0px">
      <rect x="68" y={FIRST_ROW + ROW * TOKEN_ROW - 4} width="184" height="11" rx="2" fill={INK.accent} opacity="0.18" />
      <path d="M71 {FIRST_ROW + ROW * TOKEN_ROW + 1.5}h5M73.5 {FIRST_ROW + ROW * TOKEN_ROW - 1}v5" stroke={INK.accent} stroke-width="1.2" />
    </g>
  </Slab>

  <g class="ship" style:--z="-30px">
    <Slab box={{ x: 150, y: 126, w: 96, d: 40, t: 5 }} shade={SHADES.accent}>
      <g fill="none" stroke={INK.dark} stroke-width="1.6" stroke-linecap="round">
        <circle cx="14" cy="12" r="3.5" />
        <circle cx="14" cy="28" r="3.5" />
        <circle cx="30" cy="28" r="3.5" />
        <path d="M14 15.5v9M17.5 12c7 0 12.5 4 12.5 12.5" />
      </g>
      <rect x="44" y="12" width="40" height="4" rx="2" fill={INK.dark} />
      <rect x="44" y="22" width="28" height="3" rx="1.5" fill={INK.dark} opacity="0.6" />
    </Slab>
  </g>

  <g class="layer" style:--z="-64px" style:--rise="0s" style:--dusk="0s">
    {@render page(LIGHT)}
    <g class="dusk">{@render page(DARK)}</g>
  </g>
  <g class="layer" style:--z="-100px" style:--rise="0.4s" style:--dusk="0.3s">
    {@render cards(LIGHT)}
    <g class="dusk">{@render cards(DARK)}</g>
  </g>
  <g class="layer" style:--z="-140px" style:--rise="0.8s" style:--dusk="0.6s">
    {@render hero(LIGHT)}
    <g class="dusk">{@render hero(DARK)}</g>
  </g>

  <g class="layer" style:--z="-96px" style:--rise="0.6s" style:--dusk="-0.3s">
    {@render toggle(LIGHT)}
    <g class="dusk">{@render toggle(DARK)}</g>
    <g transform={onTop(300, 34, 6)}>
      <circle class="knob" cx="14" cy="22" r="4.5" fill={INK.accent} />
    </g>
  </g>
</svg>

<style>
  .loop {
    --cycle: 10s;
    --ease: cubic-bezier(0.65, 0, 0.35, 1);

    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .layer {
    transform: translateY(var(--z));
    animation: rise var(--cycle) var(--ease) infinite;
    animation-delay: calc(var(--rise) - var(--cycle));
  }

  .dusk {
    opacity: 0;
    animation: dusk var(--cycle) var(--ease) infinite;
    animation-delay: calc(var(--dusk) - var(--cycle));
  }

  .knob {
    animation: knob var(--cycle) var(--ease) infinite;
    animation-delay: calc(-1 * var(--cycle));
  }

  .ship {
    opacity: 0;
    animation: ship var(--cycle) var(--ease) infinite;
    animation-delay: calc(-1 * var(--cycle));
  }

  :global([data-paused]) :is(.layer, .dusk, .knob, .ship) {
    animation-play-state: paused;
  }

  @keyframes rise {
    0%,
    8% {
      transform: translateY(0);
      opacity: 0;
    }
    22%,
    62% {
      transform: translateY(var(--z));
      opacity: 1;
    }
    76%,
    100% {
      transform: translateY(0);
      opacity: 0;
    }
  }

  @keyframes dusk {
    0%,
    40% {
      opacity: 0;
    }
    46%,
    86% {
      opacity: 1;
    }
    90%,
    100% {
      opacity: 0;
    }
  }

  @keyframes knob {
    0%,
    36% {
      transform: translateX(0);
    }
    42%,
    100% {
      transform: translateX(16px);
    }
  }

  @keyframes ship {
    0%,
    74% {
      transform: translateY(0);
      opacity: 0;
    }
    82%,
    94% {
      transform: translateY(var(--z));
      opacity: 1;
    }
    100% {
      transform: translateY(0);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .layer,
    .dusk,
    .knob,
    .ship {
      animation: none;
    }
  }
</style>
