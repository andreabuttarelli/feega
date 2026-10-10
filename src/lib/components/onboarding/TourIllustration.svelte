<script lang="ts">
  import { TourScene } from '$lib/onboarding/tour';

  let { scene }: { scene: TourScene } = $props();
</script>

{#snippet node(x: number, y: number, label: string, accent = false)}
  <g class="node" class:accent transform="translate({x} {y})">
    <rect width="76" height="40" />
    <text x="8" y="24">{label}</text>
  </g>
{/snippet}

<svg class="tour-art" viewBox="0 0 320 180" role="img" aria-label={scene} data-testid="tour-art">
  {#if scene === TourScene.Intro}
    <g class="prompt">
      <rect x="40" y="24" width="240" height="24" />
      <text x="50" y="40" class="typing">a launch video for my app</text>
    </g>
    <rect class="frame" x="70" y="62" width="180" height="100" />
    <rect class="bar b1" x="90" y="92" width="80" height="12" />
    <rect class="bar b2" x="90" y="112" width="120" height="8" />
    <circle class="play" cx="226" cy="142" r="9" />
    <text class="code" x="258" y="116">&lt;/&gt;</text>
  {:else if scene === TourScene.Motion}
    <rect class="frame" x="20" y="16" width="190" height="104" />
    <rect class="bar b1" x="40" y="52" width="90" height="14" />
    <rect class="panel" x="222" y="16" width="78" height="104" />
    <rect class="bubble" x="230" y="28" width="56" height="12" />
    <rect class="bubble mine" x="242" y="48" width="50" height="12" />
    <rect class="track" x="20" y="134" width="280" height="30" />
    <rect class="clip c1" x="24" y="140" width="70" height="18" />
    <rect class="clip c2" x="98" y="140" width="92" height="18" />
    <rect class="clip c3" x="194" y="140" width="60" height="18" />
    <rect class="playhead" x="60" y="130" width="2" height="38" />
  {:else if scene === TourScene.Canvas}
    <pattern id="tour-dots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" class="dot" />
    </pattern>
    <rect width="320" height="180" fill="url(#tour-dots)" />
    <g class="drift d1">{@render node(28, 28, 'image')}</g>
    <g class="drift d2">{@render node(128, 18, 'text')}</g>
    <g class="drift d3">{@render node(228, 40, 'product')}</g>
    <g class="drift d2">{@render node(60, 110, 'feed')}</g>
    <g class="drift d1">{@render node(170, 112, 'video')}</g>
  {:else if scene === TourScene.Link}
    <rect class="project" x="10" y="10" width="300" height="160" />
    <text class="caption" x="20" y="28">canvas project</text>
    <path class="edge draw" d="M96 64 C 112 64, 108 92, 122 92" />
    <path class="edge draw late" d="M96 132 C 112 132, 108 100, 122 100" />
    <path class="edge draw later" d="M198 96 C 212 96, 210 64, 224 64" />
    {@render node(20, 44, 'image')}
    {@render node(20, 112, 'text')}
    <g class="pop">{@render node(122, 76, 'motion', true)}</g>
    {@render node(224, 44, 'embed')}
    <circle class="handle" cx="122" cy="96" r="4" />
    <circle class="handle" cx="198" cy="96" r="4" />
  {:else if scene === TourScene.Flow}
    <path class="edge" d="M88 46 C 102 46, 98 90, 112 90" />
    <path class="edge" d="M88 134 C 102 134, 98 90, 112 90" />
    <path class="edge" d="M188 90 L 212 90" />
    <path class="edge" d="M288 90 L 310 90" />
    <circle class="pulse" r="4"><animateMotion dur="2.4s" repeatCount="indefinite" path="M88 46 C 102 46, 98 90, 112 90" /></circle>
    <circle class="pulse" r="4"><animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path="M188 90 L 212 90" /></circle>
    <circle class="pulse" r="4"><animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" path="M288 90 L 310 90" /></circle>
    {@render node(12, 26, 'refs')}
    {@render node(12, 114, 'images')}
    {@render node(112, 70, 'storyboard')}
    {@render node(212, 70, 'motion', true)}
  {:else}
    <g class="choice c-left">
      <rect class="tile accent-tile" x="30" y="40" width="120" height="100" />
      <polygon class="play-shape" points="80,76 80,104 104,90" />
    </g>
    <g class="choice c-right">
      <rect class="tile" x="170" y="40" width="120" height="100" />
      <rect class="mini" x="186" y="58" width="36" height="22" />
      <rect class="mini" x="236" y="70" width="36" height="22" />
      <rect class="mini" x="200" y="104" width="36" height="22" />
    </g>
  {/if}
</svg>

<style>
  .tour-art {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    background: var(--ui-surface, #fafaf8);
    color: var(--ui-ink, #111);
    font-family: var(--ui-mono, monospace);
    font-size: 9px;
  }

  rect,
  polygon {
    fill: var(--ui-bg, #fff);
    stroke: none;
  }

  text {
    fill: var(--ui-ink-2, #555);
  }

  .node rect {
    fill: var(--ui-bg, #fff);
    stroke: var(--ui-line, #ddd);
    stroke-width: 1;
  }

  .node.accent rect {
    fill: var(--ui-accent, #0099ff);
    stroke: none;
  }

  .node.accent text {
    fill: #fff;
  }

  .frame,
  .panel,
  .track,
  .tile,
  .project {
    stroke: var(--ui-line, #ddd);
  }

  .project {
    fill: transparent;
    stroke-dasharray: 4 3;
  }

  .caption {
    fill: var(--ui-ink-3, #888);
  }

  .bar,
  .clip,
  .bubble,
  .mini {
    fill: var(--ui-ink-3, #bbb);
  }

  .bubble.mine,
  .playhead,
  .play,
  .accent-tile,
  .pulse {
    fill: var(--ui-accent, #0099ff);
  }

  .play-shape {
    fill: #fff;
  }

  .code {
    fill: var(--ui-accent, #0099ff);
    font-size: 14px;
  }

  .dot {
    fill: var(--ui-ink-3, #ccc);
  }

  .edge {
    fill: none;
    stroke: var(--ui-ink-3, #999);
    stroke-width: 1.5;
  }

  .handle {
    fill: var(--ui-bg, #fff);
    stroke: var(--ui-accent, #0099ff);
    stroke-width: 1.5;
  }

  @media (prefers-reduced-motion: no-preference) {
    .typing {
      clip-path: inset(0 100% 0 0);
      animation: type 2.4s steps(26) infinite;
    }

    .bar {
      transform-box: fill-box;
      transform-origin: left;
      animation: grow 2.4s cubic-bezier(0.87, 0, 0.13, 1) infinite;
    }

    .b2 {
      animation-delay: 0.2s;
    }

    .playhead {
      animation: sweep 4s linear infinite;
    }

    .bubble {
      animation: fade 3s ease-in-out infinite;
    }

    .bubble.mine {
      animation-delay: 0.6s;
    }

    .drift {
      animation: drift 6s ease-in-out infinite alternate;
    }

    .d2 {
      animation-delay: -2s;
    }

    .d3 {
      animation-delay: -4s;
    }

    .draw {
      stroke-dasharray: 80;
      stroke-dashoffset: 80;
      animation: draw 3.6s cubic-bezier(0.87, 0, 0.13, 1) infinite;
    }

    .late {
      animation-delay: 0.3s;
    }

    .later {
      animation-delay: 0.6s;
    }

    .pop {
      transform-box: fill-box;
      transform-origin: center;
      animation: pop 3.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
    }

    .choice {
      animation: fade 3s ease-in-out infinite alternate;
    }

    .c-right {
      animation-delay: 1.5s;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse {
      display: none;
    }
  }

  @keyframes type {
    70%,
    100% {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes grow {
    0% {
      transform: scaleX(0);
    }
    40%,
    100% {
      transform: scaleX(1);
    }
  }

  @keyframes sweep {
    to {
      transform: translateX(230px);
    }
  }

  @keyframes fade {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes drift {
    to {
      transform: translate(6px, -4px);
    }
  }

  @keyframes draw {
    40%,
    100% {
      stroke-dashoffset: 0;
    }
  }

  @keyframes pop {
    0% {
      transform: scale(0.85);
      opacity: 0;
    }
    25%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
