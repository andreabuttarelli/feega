<script lang="ts">
  import type { Snippet } from 'svelte';
  import { inView } from './in-view';

  let { name, children }: { name: string; children: Snippet } = $props();
</script>

<svg class="glyph" data-glyph={name} viewBox="-62 -46 140 110" aria-hidden="true" use:inView>
  {@render children()}
</svg>

<style>
  .glyph {
    --cycle: 4s;
    --ease: cubic-bezier(0.65, 0, 0.35, 1);

    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .glyph :global(.move) {
    animation: move var(--cycle) var(--ease) infinite;
  }

  .glyph :global(:is(.select, .show)) {
    animation: show var(--cycle) var(--ease) infinite;
  }

  .glyph :global(.draw) {
    stroke-dasharray: 1;
    animation: draw var(--cycle) var(--ease) infinite;
  }

  .glyph:global([data-paused]) :global(:is(.move, .select, .show, .draw)) {
    animation-play-state: paused;
  }

  @keyframes move {
    0%,
    15% {
      transform: none;
    }
    45%,
    80% {
      transform: var(--to);
    }
    100% {
      transform: none;
    }
  }

  @keyframes show {
    0%,
    20% {
      opacity: 0;
    }
    40%,
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes draw {
    0%,
    15% {
      stroke-dashoffset: 1;
    }
    45%,
    85% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glyph :global(.move) {
      animation: none;
      transform: var(--to);
    }

    .glyph :global(:is(.select, .show, .draw)) {
      animation: none;
    }
  }
</style>
