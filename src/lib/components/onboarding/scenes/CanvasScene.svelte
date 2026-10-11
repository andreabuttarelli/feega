<script lang="ts">
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Type from '@lucide/svelte/icons/type';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
  import Play from '@lucide/svelte/icons/play';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import TourFilm from '../TourFilm.svelte';
  import TourNode from '../TourNode.svelte';
  import TourPicture from '../TourPicture.svelte';
</script>

<div class="scene">
  <div class="world">
    <div class="node video">
      <TourNode label="Launch film" icon={Clapperboard} selected>
        <TourFilm />
        <div class="bar">
          <Play size={15} strokeWidth={1.8} />
          <span class="mono">00:04 / 00:24</span>
          <span class="open">Open editor</span>
        </div>
      </TourNode>
    </div>

    <div class="node around hero" style:--i={0}>
      <TourNode label="hero.jpg" icon={ImageIcon}><TourPicture /></TourNode>
    </div>

    <div class="node around brief" style:--i={1}>
      <TourNode label="Brief" icon={Type}>
        <div class="text">
          <b>Acme launch</b>
          <p>Ship faster. Revenue up 38% for teams on the new plan. End on the logo.</p>
        </div>
      </TourNode>
    </div>

    <div class="node around board" style:--i={2}>
      <TourNode label="Storyboard" icon={LayoutGrid}>
        <div class="frames">
          {#each ['Hook', 'Product', 'Proof', 'Logo'] as f (f)}
            <span><i></i>{f}</span>
          {/each}
        </div>
      </TourNode>
    </div>

    <div class="node around shop" style:--i={3}>
      <TourNode label="Products" icon={ShoppingBag}>
        <div class="products">
          <span><TourPicture tone="warm" /><b>Runner</b> <i>€120</i></span>
          <span><TourPicture tone="cool" /><b>Trail</b> <i>€140</i></span>
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
    position: absolute;
    inset: 0;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    color: var(--ui-ink, #111);
  }

  .world {
    position: absolute;
    inset: 0;
    transform-origin: 480px 290px;
    animation: zoom var(--loop) var(--expo) infinite;
  }

  .node {
    position: absolute;
  }

  .video {
    left: 320px;
    top: 186px;
    width: 320px;
  }

  .video :global(.label),
  .bar {
    animation: chrome var(--loop) var(--expo) infinite;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
    padding: 0 12px;
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
  }

  .around {
    animation: pop var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--i) * 0.18s);
  }

  .hero {
    left: 120px;
    top: 96px;
    width: 150px;
    height: 150px;
  }

  .brief {
    left: 110px;
    top: 330px;
    width: 170px;
    height: 150px;
  }

  .board {
    left: 690px;
    top: 90px;
    width: 160px;
    height: 150px;
  }

  .shop {
    left: 690px;
    top: 330px;
    width: 160px;
    height: 150px;
  }

  .text {
    padding: 12px;
    font-size: 13px;
    line-height: 1.4;
  }

  .text b {
    font-weight: 600;
  }

  .text p {
    margin: 6px 0 0;
    color: var(--ui-ink-2, #5c5c58);
  }

  .frames {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    height: 100%;
    padding: 8px;
  }

  .frames span {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .frames i {
    flex: 1;
    background: color-mix(in srgb, var(--ui-ink, #111) 12%, transparent);
  }

  .products {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    height: 100%;
    padding: 8px;
  }

  .products span {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
  }

  .products span :global(.picture) {
    flex: 1;
  }

  .products i {
    font-style: normal;
    color: var(--ui-ink-3, #93938e);
  }

  .crumb {
    position: absolute;
    top: 20px;
    left: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 14px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 9%, transparent);
    font-size: 15px;
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
    0%, 20% { transform: scale(2.1); }
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

  @media (prefers-reduced-motion: reduce) {
    .scene * {
      animation: none !important;
    }
  }
</style>
