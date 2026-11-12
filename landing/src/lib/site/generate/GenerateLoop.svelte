<script lang="ts">
  import Slab from '../iso/Slab.svelte';
  import { inView } from '../iso/in-view';
  import { INK, SHADES, onTop, type Box } from '../iso/iso';

  const CANVAS = { x: 0, y: 0, w: 290, d: 180, t: 6 };
  const NODE_T = 4;
  const PROMPT: Box = { x: 16, y: 64, w: 78, d: 54, t: NODE_T };
  const IMAGE: Box = { x: 118, y: 12, w: 74, d: 58, t: NODE_T };
  const VIDEO: Box = { x: 206, y: 104, w: 74, d: 58, t: NODE_T };
  const LANDED = `${-(CANVAS.t + NODE_T)}px`;
  const DOTS = Array.from({ length: 9 * 6 }, (_, i) => [16 + (i % 9) * 32, 14 + Math.floor(i / 9) * 32]);
  const PROMPT_LINES = [56, 44, 30];
  const WIRES = {
    toImage: `M${PROMPT.x + PROMPT.w} 84C106 84 106 ${IMAGE.y + 30} ${IMAGE.x} ${IMAGE.y + 30}`,
    toVideo: `M${IMAGE.x + IMAGE.w} ${IMAGE.y + 30}C214 ${IMAGE.y + 30} 190 ${VIDEO.y + 22} ${VIDEO.x} ${VIDEO.y + 22}`,
    promptToVideo: `M${PROMPT.x + PROMPT.w} 104C150 104 150 ${VIDEO.y + 40} ${VIDEO.x} ${VIDEO.y + 40}`
  };
</script>

{#snippet node(box: Box, label: number, run: string)}
  <Slab {box} shade={SHADES.card}>
    <rect x="8" y="7" width={label} height="3" rx="1.5" fill={INK.light} opacity="0.6" />
    <rect x="8" y="16" width={box.w - 16} height={box.d - 24} rx="2" fill="#dcd7cd" />
    <rect class="run {run}" x="8" y={box.d - 5} width={box.w - 16} height="2" rx="1" fill={INK.accent} />
  </Slab>
{/snippet}

<svg class="loop" viewBox="-170 -96 440 330" role="img" aria-label="A prompt node feeds an image node and a video node; each result lands on the canvas and wires into the next" use:inView>
  <Slab box={CANVAS} shade={SHADES.night}>
    <g class="detail">
      {#each DOTS as [cx, cy], i (i)}
        <circle {cx} {cy} r="0.9" fill={INK.dark} opacity="0.22" />
      {/each}
    </g>
    <g fill="none" stroke={INK.dark} stroke-width="1.4" stroke-linecap="round" opacity="0.85">
      <path class="wire first" d={WIRES.toImage} pathLength="1" />
      <path class="wire second" d={WIRES.toVideo} pathLength="1" />
      <path class="wire second detail" d={WIRES.promptToVideo} pathLength="1" />
    </g>
  </Slab>

  <Slab box={PROMPT} shade={SHADES.card}>
    <rect x="8" y="7" width="20" height="3" rx="1.5" fill={INK.light} opacity="0.6" />
    {#each PROMPT_LINES as width, i (i)}
      <rect class="line" style:--at="{i * 0.4}s" x="8" y={18 + i * 9} {width} height="4" rx="2" fill={INK.light} />
    {/each}
    <rect class="caret" x="8" y="44" width="1.6" height="7" fill={INK.accent} />
  </Slab>
  {@render node(IMAGE, 24, 'first')}
  {@render node(VIDEO, 28, 'second')}

  <g class="drop first" style:--z={LANDED}>
    <g transform={onTop(IMAGE.x, IMAGE.y, 0)}>
      <rect x="8" y="16" width={IMAGE.w - 16} height={IMAGE.d - 24} rx="2" fill="#bdb7ac" />
      <path d="M12 46l16-16l12 12l8-7l14 11z" fill="#8f897f" />
      <circle cx="54" cy="24" r="4.5" fill={INK.accent} />
    </g>
  </g>

  <g class="drop second" style:--z={LANDED}>
    <g transform={onTop(VIDEO.x, VIDEO.y, 0)}>
      <rect x="8" y="16" width={VIDEO.w - 16} height={VIDEO.d - 24} rx="2" fill={INK.light} />
      <path d="M33 24l10 7l-10 7z" fill={INK.accent} />
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

  .line {
    transform-box: fill-box;
    transform-origin: left;
    animation: type var(--cycle) var(--ease) infinite;
    animation-delay: calc(var(--at) - var(--cycle));
  }

  .caret {
    opacity: 0;
    animation: caret var(--cycle) steps(1) infinite;
  }

  .wire {
    stroke-dasharray: 1;
  }

  .wire.first {
    animation: wire-first var(--cycle) var(--ease) infinite;
  }

  .wire.second {
    animation: wire-second var(--cycle) var(--ease) infinite;
  }

  .run {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: left;
  }

  .run.first {
    animation: run-first var(--cycle) linear infinite;
  }

  .run.second {
    animation: run-second var(--cycle) linear infinite;
  }

  .drop {
    transform: translateY(var(--z));
  }

  .drop.first {
    animation: drop-first var(--cycle) var(--ease) infinite;
  }

  .drop.second {
    animation: drop-second var(--cycle) var(--ease) infinite;
  }

  :global([data-paused]) :is(.line, .caret, .wire, .run, .drop) {
    animation-play-state: paused;
  }

  @keyframes type {
    0%,
    4% {
      transform: scaleX(0);
    }
    10%,
    88% {
      transform: scaleX(1);
      opacity: 1;
    }
    95% {
      transform: scaleX(1);
      opacity: 0;
    }
    100% {
      transform: scaleX(0);
      opacity: 0;
    }
  }

  @keyframes caret {
    0%,
    20%,
    100% {
      opacity: 0;
    }
    4%,
    8%,
    12%,
    16% {
      opacity: 1;
    }
    6%,
    10%,
    14%,
    18% {
      opacity: 0;
    }
  }

  @keyframes wire-first {
    0%,
    16% {
      stroke-dashoffset: 1;
    }
    26%,
    88% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
    95% {
      stroke-dashoffset: 0;
      opacity: 0;
    }
    100% {
      stroke-dashoffset: 1;
      opacity: 0;
    }
  }

  @keyframes wire-second {
    0%,
    48% {
      stroke-dashoffset: 1;
    }
    58%,
    88% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
    95% {
      stroke-dashoffset: 0;
      opacity: 0;
    }
    100% {
      stroke-dashoffset: 1;
      opacity: 0;
    }
  }

  @keyframes run-first {
    0%,
    26% {
      transform: scaleX(0);
      opacity: 1;
    }
    38% {
      transform: scaleX(1);
      opacity: 1;
    }
    42%,
    100% {
      transform: scaleX(1);
      opacity: 0;
    }
  }

  @keyframes run-second {
    0%,
    58% {
      transform: scaleX(0);
      opacity: 1;
    }
    68% {
      transform: scaleX(1);
      opacity: 1;
    }
    72%,
    100% {
      transform: scaleX(1);
      opacity: 0;
    }
  }

  @keyframes drop-first {
    0%,
    38% {
      transform: translateY(-80px);
      opacity: 0;
    }
    46%,
    88% {
      transform: translateY(var(--z));
      opacity: 1;
    }
    95%,
    100% {
      transform: translateY(var(--z));
      opacity: 0;
    }
  }

  @keyframes drop-second {
    0%,
    68% {
      transform: translateY(-80px);
      opacity: 0;
    }
    76%,
    88% {
      transform: translateY(var(--z));
      opacity: 1;
    }
    95%,
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
    .line,
    .caret,
    .wire,
    .run,
    .drop {
      animation: none;
    }
  }
</style>
