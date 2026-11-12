<script lang="ts">
  import Slab from '../iso/Slab.svelte';
  import { inView } from '../iso/in-view';
  import { INK, SHADES } from '../iso/iso';

  const TIMELINE = { x: 0, y: 0, w: 280, d: 120, t: 8 };
  const START = 64;
  const END = 266;
  const SWEEP = END - START;
  const LANES = [
    { y: 34, keys: [72, 250] },
    { y: 56, keys: [92, 150] },
    { y: 78, keys: [140, 204] },
    { y: 100, keys: [128, 192] }
  ];
  const TICKS = Array.from({ length: 14 }, (_, i) => START + i * 15);
</script>

{#snippet diamond(x: number, y: number, fill: string)}
  <rect x={x - 3} y={y - 3} width="6" height="6" transform="rotate(45 {x} {y})" {fill} />
{/snippet}

<svg class="loop" viewBox="-130 -150 390 340" role="img" aria-label="Layout layers move as a playhead sweeps a timeline of keyframes, then the frame lifts out as a video" use:inView>
  <defs>
    <clipPath id="motion-played">
      <rect class="played" x={START} y="0" width={SWEEP} height={TIMELINE.d} />
    </clipPath>
  </defs>

  <Slab box={TIMELINE} shade={SHADES.code}>
    <g class="detail">
      {#each TICKS as x (x)}
        <rect {x} y="10" width="0.8" height={(x - START) % 60 ? 3 : 6} fill={INK.dark} opacity="0.35" />
      {/each}
    </g>
    {#each LANES as lane, i (i)}
      <rect class="detail" x="12" y={lane.y - 1.5} width={i % 2 ? 26 : 34} height="3" rx="1.5" fill={INK.dark} opacity="0.28" />
      <rect x={START} y={lane.y - 0.5} width={SWEEP} height="1" fill={INK.dark} opacity="0.14" />
      {#each lane.keys as x (x)}
        {@render diamond(x, lane.y, '#555')}
      {/each}
    {/each}
    <line x1="52" y1="22" x2="52" y2="112" stroke="#262626" stroke-width="0.8" />

    <g class="trail" clip-path="url(#motion-played)">
      {#each LANES as lane, i (i)}
        <rect x={START} y={lane.y - 0.5} width={SWEEP} height="1" fill={INK.accent} opacity="0.5" />
        {#each lane.keys as x (x)}
          {@render diamond(x, lane.y, INK.accent)}
        {/each}
      {/each}
    </g>

    <g class="playhead" style:--sweep="{SWEEP}px">
      <path d="M{START - 4} 6h8v5l-4 4l-4-4z" fill={INK.accent} />
      <rect x={START - 0.6} y="14" width="1.2" height="100" fill={INK.accent} />
    </g>
  </Slab>

  <g class="out" style:--z="-76px">
    <Slab box={{ x: 206, y: 78, w: 62, d: 36, t: 5 }} shade={SHADES.card}>
      <rect x="5" y="5" width="52" height="26" rx="2" fill={INK.light} />
      <path d="M27 12.5l8 5.5l-8 5.5z" fill={INK.accent} />
    </Slab>
  </g>

  <g transform="translate(0 -112)">
    <Slab box={{ x: 40, y: 0, w: 200, d: 104, t: 4 }} shade={SHADES.paper}>
      <circle cx="12" cy="11" r="3.5" fill={INK.accent} />
      <g class="detail">
        {#each [130, 150, 170] as x (x)}
          <rect {x} y="9" width="14" height="3" rx="1.5" fill={INK.light} opacity="0.45" />
        {/each}
      </g>
    </Slab>
  </g>

  <g transform="translate(0 -122)">
    <g class="pop" style:--from="translate(-17.32px, -10px)">
      <Slab box={{ x: 58, y: 72, w: 48, d: 16, t: 3 }} shade={SHADES.accent} />
    </g>
  </g>

  <g class="rise" style:--from="-116px" style:--z="-150px">
    <Slab box={{ x: 150, y: 46, w: 76, d: 48, t: 4 }} shade={SHADES.card}>
      <rect x="6" y="6" width="64" height="36" rx="2" fill="#dcd7cd" />
      <path d="M12 36l14-14l10 10l8-6l14 10z" fill="#bdb7ac" />
      <circle cx="54" cy="16" r="4" fill={INK.accent} />
    </Slab>
  </g>

  <g transform="translate(0 -138)">
    <g class="slide" style:--from="translate(-34.64px, -20px)">
      <Slab box={{ x: 58, y: 18, w: 112, d: 30, t: 4 }} shade={SHADES.card}>
        <rect x="10" y="8" width="84" height="6" rx="2" fill={INK.light} />
        <rect x="10" y="18" width="56" height="4" rx="2" fill={INK.light} opacity="0.5" />
      </Slab>
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

  .playhead {
    transform: translateX(var(--sweep));
    animation:
      sweep var(--cycle) linear infinite,
      fade var(--cycle) var(--ease) infinite;
  }

  .played {
    transform-box: fill-box;
    transform-origin: left;
    animation: played var(--cycle) linear infinite;
  }

  .trail {
    animation: fade var(--cycle) var(--ease) infinite;
  }

  .slide {
    animation: slide var(--cycle) var(--ease) infinite;
  }

  .rise {
    transform: translateY(var(--z));
    animation: rise var(--cycle) var(--ease) infinite;
  }

  .pop {
    animation: pop var(--cycle) var(--ease) infinite;
  }

  .out {
    transform: translateY(var(--z));
    animation: out var(--cycle) var(--ease) infinite;
  }

  :global([data-paused]) :is(.playhead, .played, .trail, .slide, .rise, .pop, .out) {
    animation-play-state: paused;
  }

  @keyframes sweep {
    0%,
    8% {
      transform: translateX(0);
    }
    60%,
    94% {
      transform: translateX(var(--sweep));
    }
    95%,
    100% {
      transform: translateX(0);
    }
  }

  @keyframes played {
    0%,
    8% {
      transform: scaleX(0);
    }
    60%,
    94% {
      transform: scaleX(1);
    }
    95%,
    100% {
      transform: scaleX(0);
    }
  }

  @keyframes fade {
    0%,
    86% {
      opacity: 1;
    }
    93%,
    95% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes slide {
    0%,
    12% {
      transform: var(--from);
    }
    30%,
    86% {
      transform: none;
    }
    96%,
    100% {
      transform: var(--from);
    }
  }

  @keyframes rise {
    0%,
    26% {
      transform: translateY(var(--from));
    }
    42%,
    86% {
      transform: translateY(var(--z));
    }
    96%,
    100% {
      transform: translateY(var(--from));
    }
  }

  @keyframes pop {
    0%,
    40% {
      transform: var(--from);
      opacity: 0;
    }
    54%,
    86% {
      transform: none;
      opacity: 1;
    }
    94%,
    100% {
      transform: var(--from);
      opacity: 0;
    }
  }

  @keyframes out {
    0%,
    64% {
      transform: translateY(0);
      opacity: 0;
    }
    76%,
    88% {
      transform: translateY(var(--z));
      opacity: 1;
    }
    94%,
    100% {
      transform: translateY(var(--z));
      opacity: 0;
    }
  }

  @media (max-width: 809.98px) {
    .detail {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .playhead,
    .played,
    .trail,
    .slide,
    .rise,
    .pop,
    .out {
      animation: none;
    }
  }
</style>
