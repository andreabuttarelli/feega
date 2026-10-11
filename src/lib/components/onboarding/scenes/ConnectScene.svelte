<script lang="ts">
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import ImageIcon from '@lucide/svelte/icons/image';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import Square from '@lucide/svelte/icons/square';
  import Play from '@lucide/svelte/icons/play';
  import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
  import TourFilm from '../TourFilm.svelte';
  import TourNode from '../TourNode.svelte';
  import TourPicture from '../TourPicture.svelte';

  type Edge = { from: [number, number]; to: [number, number]; port: ConnectorType; at: number };

  const BEND = 56;

  const EDGES: Edge[] = [
    { from: [270, 120], to: [350, 263], port: 'images', at: 0 },
    { from: [270, 280], to: [350, 263], port: 'images', at: 1 },
    { from: [270, 455], to: [350, 327], port: 'text', at: 2 },
    { from: [610, 295], to: [690, 170], port: 'motions', at: 6 },
    { from: [610, 295], to: [700, 436], port: 'motions', at: 7 }
  ];

  function curve({ from: [x1, y1], to: [x2, y2] }: Edge): string {
    return `M${x1} ${y1} C${x1 + BEND} ${y1}, ${x2 - BEND} ${y2}, ${x2} ${y2}`;
  }
</script>

<div class="scene">
  <svg class="edges" viewBox="0 0 960 600">
    {#each EDGES as edge (edge.at)}
      <path d={curve(edge)} pathLength="1" class:out={edge.port === 'motions'} stroke={CONNECTOR_STYLE[edge.port].color} style:--at={edge.at} />
    {/each}
  </svg>

  <div class="node input logo" style:--at={0}>
    <TourNode label="logo.svg" icon={ImageIcon} output="images">
      <div class="logo-art"><span></span>acme</div>
    </TourNode>
  </div>

  <div class="node input shots" style:--at={1}>
    <TourNode label="Product shots" icon={ImageIcon} output="images">
      <div class="grid">
        <TourPicture /><TourPicture tone="warm" /><TourPicture tone="cool" /><TourPicture tone="warm" />
      </div>
    </TourNode>
  </div>

  <div class="node input board" style:--at={2}>
    <TourNode label="Storyboard" icon={LayoutGrid} output="text">
      <ol class="beats">
        <li><b>1</b> Hook: ship faster</li>
        <li><b>2</b> The product</li>
        <li><b>3</b> Revenue +38%</li>
        <li><b>4</b> Logo</li>
      </ol>
    </TourNode>
  </div>

  <div class="node video">
    <TourNode label="Launch film" icon={Clapperboard} inputs={['images', 'text']} output="motions" selected>
      <div class="screen">
        <TourFilm />
        <div class="after"><TourFilm intro="run faster." accent="#e4572e" /></div>
      </div>
      <div class="bar"><Play size={14} strokeWidth={1.8} /><span class="mono">00:24</span></div>
    </TourNode>
  </div>

  <div class="node output post" style:--at={6}>
    <TourNode label="Post 4:5" icon={Square} inputs={['motions']}>
      <div class="ig">
        <div class="ig-head"><span class="avatar"></span>acme</div>
        <TourFilm intro="run faster." accent="#e4572e" ratio="4 / 5" />
        <div class="ig-foot">New: Runner. Out now.</div>
      </div>
    </TourNode>
  </div>

  <div class="node output cut" style:--at={7}>
    <TourNode label="Cut-down 9:16" icon={Smartphone} inputs={['motions']}>
      <TourFilm intro="run." accent="#e4572e" ratio="9 / 16" />
    </TourNode>
  </div>
</div>

<style>
  .scene {
    --loop: 11s;
    --step: 0.35s;
    --expo: cubic-bezier(0.16, 1, 0.3, 1);
    position: absolute;
    inset: 0;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    color: var(--ui-ink, #111);
  }

  .edges {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .edges path {
    fill: none;
    stroke-width: 2.5;
    stroke-dasharray: 1;
    animation: draw var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--at) * var(--step));
  }

  .edges path.out {
    animation-name: draw-out;
    animation-delay: calc((var(--at) - 6) * var(--step));
  }

  .node {
    position: absolute;
  }

  .input {
    left: 120px;
    width: 150px;
    animation: pop-in var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--at) * var(--step));
  }

  .output {
    animation: pop-out var(--loop) var(--expo) infinite;
    animation-delay: calc((var(--at) - 6) * var(--step));
  }

  .logo {
    top: 70px;
    height: 100px;
  }

  .shots {
    top: 220px;
    height: 120px;
  }

  .board {
    top: 400px;
    height: 110px;
  }

  .logo-art {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.05em;
  }

  .logo-art span {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ui-ink, #111);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 3px;
    height: 100%;
    padding: 3px;
  }

  .beats {
    margin: 0;
    padding: 10px 12px;
    list-style: none;
    font-size: 12px;
    line-height: 1.75;
    color: var(--ui-ink-2, #5c5c58);
  }

  .beats b {
    display: inline-block;
    width: 14px;
    font-family: var(--ui-mono, monospace);
    font-weight: 400;
    color: var(--ui-ink-3, #93938e);
  }

  .video {
    left: 350px;
    top: 200px;
    width: 260px;
  }

  .screen {
    position: relative;
  }

  .after {
    position: absolute;
    inset: 0;
    animation: refresh var(--loop) var(--expo) infinite;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 12px;
  }

  .mono {
    font-family: var(--ui-mono, monospace);
    font-size: 12px;
    color: var(--ui-ink-2, #5c5c58);
  }

  .post {
    left: 690px;
    top: 50px;
    width: 150px;
  }

  .ig {
    font-size: 11px;
  }

  .ig-head,
  .ig-foot {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    font-weight: 600;
  }

  .ig-foot {
    font-weight: 400;
    color: var(--ui-ink-2, #5c5c58);
  }

  .avatar {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #e4572e;
  }

  .cut {
    left: 700px;
    top: 330px;
    width: 120px;
  }

  @keyframes draw {
    0%, 16% { stroke-dashoffset: 1; }
    26%, 100% { stroke-dashoffset: 0; }
  }

  @keyframes draw-out {
    0%, 50% { stroke-dashoffset: 1; }
    60%, 100% { stroke-dashoffset: 0; }
  }

  @keyframes pop-in {
    0%, 4% { opacity: 0; transform: translateX(-24px); }
    12%, 100% { opacity: 1; transform: none; }
  }

  @keyframes refresh {
    0%, 38% { opacity: 0; }
    44%, 100% { opacity: 1; }
  }

  @keyframes pop-out {
    0%, 46% { opacity: 0; transform: translateX(24px); }
    54%, 100% { opacity: 1; transform: none; }
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
