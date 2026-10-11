<script lang="ts">
  import ImageIcon from '@lucide/svelte/icons/image';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import Square from '@lucide/svelte/icons/square';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import { CONNECTOR_STYLE, type ConnectorType } from '$lib/canvas/connectors';
  import TourFilm from '../../TourFilm.svelte';
  import TourNode from '../../TourNode.svelte';
  import { NodeFlow } from '$lib/onboarding/stage';
  import TourPicture from '../../TourPicture.svelte';

  type Point = [number, number];
  type Rect = { x: number; y: number; w: number; h: number };
  type Edge = { from: Point; to: Point; port: ConnectorType; at: number };

  const PAD = { side: 16, top: 92, bottom: 36 };
  const GAP = { inputs: 10, outputs: 36, rows: 30 };
  const POST_HEAD = 26;
  const VIDEO_MAX = 300;

  let width = $state(0);
  let height = $state(0);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const bottomOf = (r: Rect, along = 0.5): Point => [r.x + r.w * along, r.y + r.h];
  const topOf = (r: Rect, along = 0.5): Point => [r.x + r.w * along, r.y];

  const layout = $derived.by(() => {
    const room = height - PAD.top - PAD.bottom;
    const inW = (width - 2 * PAD.side - 2 * GAP.inputs) / 3;
    const inH = clamp(room * 0.18, 72, 100);
    const outH = clamp(room * 0.28, 90, 150);
    const videoRoom = room - inH - outH - 2 * GAP.rows;
    const videoW = Math.min(VIDEO_MAX, (videoRoom * 16) / 9);
    const videoH = (videoW * 9) / 16;

    const inputs = [0, 1, 2].map((i): Rect => ({ x: PAD.side + i * (inW + GAP.inputs), y: PAD.top, w: inW, h: inH }));
    const video: Rect = { x: (width - videoW) / 2, y: PAD.top + inH + GAP.rows + (videoRoom - videoH) / 2, w: videoW, h: videoH };
    const cutW = (outH * 9) / 16;
    const postW = ((outH - POST_HEAD) * 4) / 5;
    const outY = height - PAD.bottom - outH;
    const outX = (width - postW - cutW - GAP.outputs) / 2;
    const post: Rect = { x: outX, y: outY, w: postW, h: outH };
    const cut: Rect = { x: outX + postW + GAP.outputs, y: outY, w: cutW, h: outH };

    const edges: Edge[] = [
      { from: bottomOf(inputs[0]), to: topOf(video, 1 / 3), port: 'images', at: 0 },
      { from: bottomOf(inputs[1]), to: topOf(video, 1 / 3), port: 'images', at: 1 },
      { from: bottomOf(inputs[2]), to: topOf(video, 2 / 3), port: 'text', at: 2 },
      { from: bottomOf(video), to: topOf(post), port: 'motions', at: 6 },
      { from: bottomOf(video), to: topOf(cut), port: 'motions', at: 7 }
    ];
    return { inputs, video, post, cut, edges };
  });

  function curve({ from: [x1, y1], to: [x2, y2] }: Edge): string {
    const bend = (y2 - y1) / 2;
    return `M${x1} ${y1} C${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
  }

  function box(r: Rect): string {
    return `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
  }
</script>

<div class="scene" bind:clientWidth={width} bind:clientHeight={height}>
  {#if width > 0}
    <svg class="edges" viewBox="0 0 {width} {height}">
      {#each layout.edges as edge (edge.at)}
        <path d={curve(edge)} pathLength="1" class:out={edge.port === 'motions'} stroke={CONNECTOR_STYLE[edge.port].color} style:--at={edge.at} />
      {/each}
    </svg>

    <div class="node input" style={box(layout.inputs[0])} style:--at={0}>
      <TourNode label="logo.svg" icon={ImageIcon} output="images" flow={NodeFlow.Down}>
        <div class="logo-art"><span></span>acme</div>
      </TourNode>
    </div>

    <div class="node input" style={box(layout.inputs[1])} style:--at={1}>
      <TourNode label="Shots" icon={ImageIcon} output="images" flow={NodeFlow.Down}>
        <div class="grid">
          <TourPicture /><TourPicture tone="warm" /><TourPicture tone="cool" /><TourPicture tone="warm" />
        </div>
      </TourNode>
    </div>

    <div class="node input" style={box(layout.inputs[2])} style:--at={2}>
      <TourNode label="Story" icon={LayoutGrid} output="text" flow={NodeFlow.Down}>
        <ol class="beats">
          <li><b>1</b> Hook</li>
          <li><b>2</b> Product</li>
          <li><b>3</b> +38%</li>
        </ol>
      </TourNode>
    </div>

    <div class="node video" style={box(layout.video)}>
      <TourNode label="" icon={Clapperboard} inputs={['images', 'text']} output="motions" flow={NodeFlow.Down} selected>
        <div class="screen">
          <TourFilm />
          <div class="after"><TourFilm intro="run faster." accent="#e4572e" /></div>
        </div>
      </TourNode>
    </div>

    <div class="node output" style={box(layout.post)} style:--at={6}>
      <TourNode label="Post 4:5" icon={Square} inputs={['motions']} flow={NodeFlow.Down}>
        <div class="ig-head"><span class="avatar"></span>acme</div>
        <TourFilm intro="run." accent="#e4572e" ratio="4 / 5" />
      </TourNode>
    </div>

    <div class="node output" style={box(layout.cut)} style:--at={7}>
      <TourNode label="9:16" icon={Smartphone} inputs={['motions']} flow={NodeFlow.Down}>
        <TourFilm intro="run." accent="#e4572e" ratio="9 / 16" />
      </TourNode>
    </div>
  {/if}
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

  .node :global(.label) {
    font-size: 13px;
  }

  .video :global(.label) {
    display: none;
  }

  .output :global(.label) {
    top: 100%;
    bottom: auto;
    margin: 8px 0 0;
  }

  .input {
    animation: pop-in var(--loop) var(--expo) infinite;
    animation-delay: calc(var(--at) * var(--step));
  }

  .output {
    animation: pop-out var(--loop) var(--expo) infinite;
    animation-delay: calc((var(--at) - 6) * var(--step));
  }

  .logo-art {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.05em;
  }

  .logo-art span {
    width: 18px;
    height: 18px;
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
    padding: 6px 8px;
    list-style: none;
    font-size: 12px;
    line-height: 1.5;
    color: var(--ui-ink-2, #5c5c58);
  }

  .beats b {
    display: inline-block;
    width: 12px;
    font-family: var(--ui-mono, monospace);
    font-weight: 400;
    color: var(--ui-ink-3, #93938e);
  }

  .screen {
    position: relative;
  }

  .after {
    position: absolute;
    inset: 0;
    animation: refresh var(--loop) var(--expo) infinite;
  }

  .ig-head {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    font-size: 12px;
    font-weight: 600;
  }

  .avatar {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #e4572e;
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
    0%, 4% { opacity: 0; transform: translateY(-20px); }
    12%, 100% { opacity: 1; transform: none; }
  }

  @keyframes refresh {
    0%, 38% { opacity: 0; }
    44%, 100% { opacity: 1; }
  }

  @keyframes pop-out {
    0%, 46% { opacity: 0; transform: translateY(20px); }
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
