<script lang="ts">
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Type from '@lucide/svelte/icons/type';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
  import Play from '@lucide/svelte/icons/play';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import TourFilm from '../../TourFilm.svelte';
  import TourNode from '../../TourNode.svelte';
  import TourPicture from '../../TourPicture.svelte';
</script>

<div class="scene">
  <div class="world">
    <div class="node around" style:--i={0}>
      <TourNode label="hero.jpg" icon={ImageIcon}><TourPicture /></TourNode>
    </div>

    <div class="node around" style:--i={1}>
      <TourNode label="Brief" icon={Type}>
        <div class="text">
          <b>Acme launch</b>
          <p>Ship faster. Revenue up 38%. End on the logo.</p>
        </div>
      </TourNode>
    </div>

    <div class="node video">
      <TourNode label="Launch film" icon={Clapperboard} selected>
        <TourFilm />
        <div class="bar">
          <Play size={14} strokeWidth={1.8} />
          <span class="mono">0:24</span>
          <span class="open">Open editor</span>
        </div>
      </TourNode>
    </div>

    <div class="node around" style:--i={2}>
      <TourNode label="Storyboard" icon={LayoutGrid}>
        <div class="frames">
          {#each ['Hook', 'Product', 'Proof', 'Logo'] as f (f)}
            <span><i></i>{f}</span>
          {/each}
        </div>
      </TourNode>
    </div>

    <div class="node around" style:--i={3}>
      <TourNode label="Products" icon={ShoppingBag}>
        <div class="products">
          <span><TourPicture tone="warm" /><b>Runner</b></span>
          <span><TourPicture tone="cool" /><b>Trail</b></span>
        </div>
      </TourNode>
    </div>
  </div>

  <div class="crumb">
    <span>Acme</span><i>/</i><b>Launch film</b><ChevronDown size={14} strokeWidth={1.8} />
  </div>
</div>

<style>
  .scene {
    --loop: 10s;
    --expo: cubic-bezier(0.16, 1, 0.3, 1);
    --bar: 40px;
    --gap: 34px;
    --row: 84px;
    position: absolute;
    inset: 0;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    color: var(--ui-ink, #111);
  }

  .world {
    position: absolute;
    inset: 96px 20px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: minmax(var(--row), 1fr) auto minmax(var(--row), 1fr);
    column-gap: 16px;
    row-gap: var(--gap);
    container-type: size;
    transform-origin: 50% 50%;
    animation: zoom var(--loop) var(--expo) infinite;
  }

  .node :global(.label) {
    font-size: 13px;
  }

  .video {
    grid-column: 1 / -1;
    justify-self: center;
    width: min(100cqw, (100cqh - 2 * var(--row) - 2 * var(--gap) - var(--bar)) * 16 / 9);
  }

  .video :global(.label),
  .bar {
    animation: chrome var(--loop) var(--expo) infinite;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--bar);
    padding: 0 10px;
    font-size: 13px;
  }

  .mono {
    font-family: var(--ui-mono, monospace);
    font-size: 12px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .open {
    margin-left: auto;
    color: var(--ui-accent, #0099ff);
    font-weight: 500;
    white-space: nowrap;
  }

  .around {
    animation: pop var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--i) * 0.18s);
  }

  .text {
    padding: 10px;
    font-size: 13px;
    line-height: 1.35;
  }

  .text b {
    font-weight: 600;
  }

  .text p {
    margin: 4px 0 0;
    color: var(--ui-ink-2, #5c5c58);
  }

  .frames,
  .products {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    height: 100%;
    padding: 8px;
  }

  .frames {
    grid-template-rows: 1fr 1fr;
  }

  .frames span,
  .products span {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 0;
    font-size: 12px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .frames i {
    flex: 1;
    background: color-mix(in srgb, var(--ui-ink, #111) 12%, transparent);
  }

  .products span :global(.picture) {
    flex: 1;
    min-height: 0;
  }

  .products b {
    font-weight: 500;
    color: var(--ui-ink, #111);
  }

  .crumb {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 12px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 9%, transparent);
    font-size: 14px;
    color: var(--ui-ink-2, #5c5c58);
    animation: chrome var(--loop) var(--expo) infinite;
  }

  .crumb i {
    font-style: normal;
    opacity: 0.5;
  }

  .crumb b {
    color: var(--ui-ink, #111);
    font-weight: 600;
  }

  @keyframes zoom {
    0%, 20% { transform: scale(1.9); }
    40%, 100% { transform: none; }
  }

  @keyframes chrome {
    0%, 30% { opacity: 0; }
    42%, 100% { opacity: 1; }
  }

  @keyframes pop {
    0%, 40% { opacity: 0; transform: scale(0.85) translateY(20px); }
    52%, 100% { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: no-preference) {
    .scene {
      animation: tour-seam var(--loop) linear infinite;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene * {
      animation: none !important;
    }
  }
</style>
