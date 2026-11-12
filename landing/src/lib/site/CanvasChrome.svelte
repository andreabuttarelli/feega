<script lang="ts">
  import Mark from './Mark.svelte';
  import { ICONS, type IconName } from './canvas-icons';
  import { ChromeKind, type Panels, type Pose, type Size } from './canvas-ending';

  type Pick = { x: number; y: number; w: number; h: number; size: number; leading: number };
  type Layer = { name: string; icon: IconName; depth: number; open?: boolean; picked?: boolean };

  let { kind, panels, pose, frame, pick }: { kind: ChromeKind; panels: Panels; pose: Pose; frame: Size; pick: Pick } = $props();

  const PROJECT = 'feega.app';
  const FRAME_NAME = 'Home';
  const PICK_NAME = 'feega';
  const ORANGE = 'FF5100';
  const PAGES = ['Home', 'Codebase', 'Changelog'];
  const PEERS = [
    { initial: 'C', colour: '#30a46c' },
    { initial: 'A', colour: '#0090ff' },
    { initial: 'M', colour: '#8e4ec6' }
  ];
  const RAIL: IconName[] = ['layers', 'images', 'palette', 'users-round', 'component', 'history', 'swatch-book'];
  const TOOL_GROUPS: { tools: IconName[]; generate?: boolean; wide?: boolean }[] = [
    { tools: ['mouse-pointer-2'] },
    { tools: ['square', 'circle', 'type', 'pen-tool', 'frame'] },
    { tools: ['pilcrow', 'image', 'video', 'audio-lines'], generate: true, wide: true },
    { tools: ['plus', 'message-circle'], wide: true }
  ];
  const MODES: IconName[] = ['pen-tool', 'diamond', 'play', 'code-xml'];
  const LAYERS: Layer[] = [
    { name: FRAME_NAME, icon: 'image', depth: 0, open: true },
    { name: 'Hero', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Open source', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Design in your codebase', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Animate any layout', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Generate on the canvas', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Agents', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Pricing', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Story', icon: 'stretch-horizontal', depth: 1 },
    { name: 'FAQ', icon: 'stretch-horizontal', depth: 1 },
    { name: 'Footer', icon: 'stretch-horizontal', depth: 1, open: true },
    { name: 'Ready?', icon: 'type', depth: 2 },
    { name: 'Navigate', icon: 'stretch-horizontal', depth: 2 },
    { name: 'Open building', icon: 'stretch-horizontal', depth: 2 },
    { name: PICK_NAME, icon: 'type', depth: 2, picked: true },
    { name: 'Legal', icon: 'stretch-horizontal', depth: 2 }
  ];
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  const px = (n: number) => String(Math.round(n));
  const layout = $derived([
    ['X', px(pick.x)],
    ['Y', px(pick.y)],
    ['W', px(pick.w)],
    ['H', px(pick.h)]
  ]);
</script>

{#snippet icon(name: IconName, size = 16, stroke = 1.8)}
  <svg class="i" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round">{@html ICONS[name]}</svg>
{/snippet}

{#snippet chip(label: string, value: string, unit = '')}
  <span class="chip"><span class="chip-label">{label}</span><span class="chip-value">{value}</span>{#if unit}<span class="chip-unit">{unit}</span>{/if}</span>
{/snippet}

{#snippet zoom()}
  <span class="zoom-value scrub"></span>
{/snippet}

{#snippet section(title: string)}
  <div class="sec-head"><span>{title}</span><span class="sec-fold">{@render icon('chevron-down', 14)}</span></div>
{/snippet}

<div class="canvas scrub" aria-hidden="true" style:--tile="{24 * Math.max(pose.scale, 0.25)}px" style:--dot="{Math.max(pose.scale, 0.25)}px"></div>

<div
  class="chrome"
  aria-hidden="true"
  inert
  data-kind={kind}
  style:--left-w="{panels.left}px"
  style:--right-w="{panels.right}px"
  style:--label-size="{12 * Math.min(1, Math.max(0.8, pose.scale ** 0.3))}px"
>
  <div class="overlay scrub">
    <span class="frame-label">{@render icon('image', 12)}{FRAME_NAME}</span>
    <div class="pick" style:left="{pick.x * pose.scale}px" style:top="{pick.y * pose.scale}px" style:width="{pick.w * pose.scale}px" style:height="{pick.h * pose.scale}px">
      {#each HANDLES as h (h)}<span class="handle {h}"></span>{/each}
    </div>
  </div>

  <header class="top from-top scrub">
    <div class="group">
      <span class="menu">
        <Mark size={16} />
        {@render icon('chevron-down', 12, 2)}
      </span>
      <span class="switcher">{PROJECT}{@render icon('chevron-down', 16)}</span>
      {#if kind === ChromeKind.Full}
        <span class="ghost">{@render icon('plug', 14)}Connect</span>
      {/if}
    </div>

    <div class="group">
      <span class="peers">
        {#each PEERS as p (p.initial)}<span class="peer" style:background={p.colour}>{p.initial}</span>{/each}
      </span>
      {#if kind === ChromeKind.Full}
        <span class="dot"></span>
        <span class="credits">{@render icon('circle-dollar-sign', 13)}1,240</span>
      {/if}
      <span class="share">{@render icon('share-2', 14)}Share</span>
      {#if kind === ChromeKind.Full}
        <span class="view">{@render icon('eye')}{@render zoom()}</span>
        <span class="round">{@render icon('message-square')}</span>
      {/if}
    </div>
  </header>

  {#if kind === ChromeKind.Full}
    <nav class="rail from-left scrub">
      {#each RAIL as name, i (name)}
        <span class="rail-btn" class:on={i === 0}>{@render icon(name, 18)}</span>
      {/each}
      <span class="rail-rule"></span>
      <span class="rail-btn">{@render icon('settings', 18)}</span>
    </nav>

    <aside class="panel left from-left scrub">
      <div class="pages">
        <div class="head">{@render icon('chevron-down', 12)}<span>Pages</span><span class="spring"></span><span class="mini">{@render icon('ellipsis', 14)}</span></div>
        {#each PAGES as name, i (name)}
          <div class="page" class:current={i === 0}>{name}</div>
        {/each}
      </div>
      <div class="strip"></div>
      <div class="head layers-head"><span>Layers</span><span class="spring"></span><span class="mini">{@render icon('search', 14)}</span></div>
      <div class="layers">
        {#each LAYERS as l (l.name)}
          <div class="row" class:picked={l.picked} style:padding-left="{20 + l.depth * 12}px">
            <span class="fold">{#if l.open}{@render icon('chevron-down', 12)}{/if}</span>
            <span class="type">{@render icon(l.icon, 14, 1.75)}</span>
            <span class="name">{l.name}</span>
          </div>
        {/each}
      </div>
    </aside>

    <aside class="panel right from-right scrub">
      <div class="tabs">
        <div class="track"><span class="on">Properties</span><span>Guides</span></div>
      </div>
      <div class="ins-head">
        <span class="kind-icon">{@render icon('type', 14)}</span>
        <span class="ins-name">{PICK_NAME}</span>
        <span class="spring"></span>
        <span class="ins-kind">Text</span>
        <span class="mini">{@render icon('copy', 14)}</span>
        <span class="mini">{@render icon('component', 14)}</span>
        <span class="mini">{@render icon('ellipsis', 14)}</span>
      </div>
      <div class="sec">
        {@render section('Layout')}
        <div class="grid2">
          {#each layout as [label, value] (label)}{@render chip(label, value, 'px')}{/each}
        </div>
      </div>
      <div class="sec">
        {@render section('Fill')}
        <div class="paint">
          <span class="swatch"></span>
          <span class="paint-text"><span class="hex">{ORANGE}</span><span class="meta">100% · Solid</span></span>
          <span class="mini">{@render icon('eye', 13, 2)}</span>
          <span class="mini">{@render icon('minus', 16, 2)}</span>
        </div>
      </div>
      <div class="sec">
        {@render section('Typography')}
        <div class="field">DM Sans{@render icon('chevron-down', 14)}</div>
        <div class="grid2">
          <span class="field">Medium{@render icon('chevron-down', 14)}</span>
          {@render chip('Size', px(pick.size))}
          {@render chip('Leading', px(pick.leading))}
          {@render chip('Spacing', '-5', '%')}
        </div>
      </div>
    </aside>

    <div class="tools from-bottom scrub">
      {#each TOOL_GROUPS as group, g (g)}
        <span class="tool-group" class:wide={group.wide}>
          {#each group.tools as tool (tool)}
            <span class="tool" class:on={tool === 'mouse-pointer-2'}>
              {@render icon(tool, tool === 'plus' ? 18 : 17, 1.7)}
              {#if group.generate}<svg class="badge" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor" /><path d="M5 2.6v4.8M2.6 5h4.8" /></svg>{/if}
            </span>
          {/each}
          <span class="tool-rule"></span>
        </span>
      {/each}
      <span class="modes">
        {#each MODES as mode, i (mode)}<span class="mode" class:on={i === 0}>{@render icon(mode, 14)}</span>{/each}
      </span>
    </div>
  {/if}

  {#if kind === ChromeKind.Compact}
    <div class="zoom from-bottom scrub">{@render zoom()}</div>
  {/if}
</div>

<style>
  @property --zoom {
    syntax: '<integer>';
    inherits: false;
    initial-value: 100;
  }

  .canvas {
    position: fixed;
    inset: 0;
    z-index: var(--site-z-canvas);
    background-color: #121212;
    background-image: radial-gradient(circle, #313131 var(--dot), transparent var(--dot));
    background-size: var(--tile) var(--tile);
    pointer-events: none;
    animation-name: fade-in;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }

    25%,
    to {
      opacity: 1;
    }
  }

  .chrome,
  .chrome * {
    box-sizing: border-box;
  }

  .chrome {
    position: fixed;
    inset: 0;
    z-index: var(--site-z-canvas-chrome);
    pointer-events: none;
    color: #f2f2f2;
    font-family: 'BDO Grotesk', -apple-system, sans-serif;
    font-variation-settings: normal;
    font-weight: 400;
    font-size: 12px;
    line-height: 1.5;
    letter-spacing: -0.02em;
    user-select: none;
  }

  .i {
    display: block;
    flex: none;
  }

  .from-top {
    animation-name: from-top;
  }

  .from-left {
    animation-name: from-left;
  }

  .from-right {
    animation-name: from-right;
  }

  .from-bottom {
    animation-name: from-bottom;
  }

  @keyframes from-top {
    from,
    30% {
      opacity: 0;
      transform: translateY(-12px);
    }

    75%,
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes from-left {
    from,
    35% {
      opacity: 0;
      transform: translateX(-24px);
    }

    80%,
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes from-right {
    from,
    35% {
      opacity: 0;
      transform: translateX(24px);
    }

    80%,
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes from-bottom {
    from,
    15% {
      opacity: 0;
      transform: translateY(12px);
    }

    50%,
    to {
      opacity: 1;
      transform: none;
    }
  }

  .overlay {
    position: absolute;
    left: var(--pose-x);
    top: var(--pose-y);
    width: var(--end-w);
    height: var(--end-h);
    transform-origin: 0 0;
    animation-name: overlay-in;
  }

  @keyframes overlay-in {
    from {
      opacity: 0;
      transform: translate(var(--from-x), var(--from-y)) scale(var(--from-s));
    }

    60% {
      opacity: 0;
    }

    90% {
      opacity: 1;
    }

    to {
      opacity: 1;
      transform: translate(0, 0) scale(1);
    }
  }

  .frame-label {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    display: flex;
    align-items: center;
    gap: 5px;
    color: #6e6e73;
    font-size: var(--label-size);
    line-height: 1.3;
    white-space: nowrap;
  }

  .pick {
    position: absolute;
    border: 1px solid #0099ff;
  }

  .handle {
    position: absolute;
    width: 8px;
    height: 8px;
    margin: -4.5px;
    border: 1px solid #0099ff;
    border-radius: 2px;
    background: #1f1f1f;
  }

  .nw,
  .w,
  .sw {
    left: 0;
  }

  .ne,
  .e,
  .se {
    left: 100%;
  }

  .n,
  .s {
    left: 50%;
  }

  .nw,
  .n,
  .ne {
    top: 0;
  }

  .sw,
  .s,
  .se {
    top: 100%;
  }

  .w,
  .e {
    top: 50%;
  }

  .top {
    position: absolute;
    inset: 0 0 auto;
    height: 48px;
    padding: 0 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .group,
  .rail,
  .tools,
  .zoom {
    background: #272727;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.08),
      0 12px 32px -8px rgb(0 0 0 / 0.7);
  }

  .group {
    height: 38px;
    padding: 0 5px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 9999px;
  }

  .menu {
    height: 28px;
    padding: 0 6px 0 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 4px;
    color: #b0b0b0;
  }

  .switcher {
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 5px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
  }

  .ghost,
  .share {
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 4px;
    font-weight: 600;
    color: #b0b0b0;
  }

  .share {
    color: #fff;
    background: #0b6bcb;
  }

  .peers {
    display: flex;
    padding-left: 6px;
  }

  .peer {
    width: 28px;
    height: 28px;
    margin-left: -6px;
    display: grid;
    place-items: center;
    border: 2px solid #181818;
    border-radius: 9999px;
    color: #fff;
    font-weight: 600;
  }

  .dot {
    width: 8px;
    height: 8px;
    margin-inline: 6px 2px;
    border-radius: 9999px;
    background: #30a46c;
  }

  .credits {
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 0.3em;
    border-radius: 9999px;
    background: #181818;
    color: #b0b0b0;
    font-family: 'Fragment Mono', monospace;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .credits .i {
    color: #a1a1a6;
  }

  .round {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    color: #b0b0b0;
  }

  .rail {
    position: absolute;
    left: 12px;
    top: 0;
    bottom: 0;
    height: fit-content;
    margin-block: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border-radius: 9999px;
  }

  .rail-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    color: #b0b0b0;
  }

  .rail-btn.on,
  .tool.on {
    background: rgb(11 107 203 / 0.22);
    color: #3ab0ff;
  }

  .rail-rule {
    width: 16px;
    height: 1px;
    background: #3e3e3e;
  }

  .panel {
    position: absolute;
    top: 56px;
    bottom: 12px;
    overflow: hidden;
    border-radius: 10px;
    background: #272727;
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.08),
      0 12px 32px -8px rgb(0 0 0 / 0.7);
  }

  .left {
    left: 68px;
    width: var(--left-w);
  }

  .right {
    right: 12px;
    width: var(--right-w);
  }

  .pages {
    padding: 4px 6px 0;
  }

  .head {
    height: 28px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 4px;
    color: #b0b0b0;
    font-size: 11px;
    font-weight: 500;
  }

  .spring {
    flex: 1;
  }

  .mini {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    color: #b0b0b0;
  }

  .page {
    position: relative;
    height: 28px;
    padding: 0 8px 0 20px;
    display: flex;
    align-items: center;
    border-radius: 4px;
  }

  .page.current {
    background: rgb(11 107 203 / 0.22);
    font-weight: 500;
  }

  .page.current::before {
    content: '';
    position: absolute;
    left: 8px;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #0099ff;
  }

  .strip {
    height: 7px;
    margin: 0 6px;
    background: linear-gradient(#313131, #313131) center / 100% 1px no-repeat;
  }

  .layers-head {
    margin-top: 4px;
    padding: 0 6px 0 14px;
  }

  .layers {
    padding: 0 6px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .row {
    height: 28px;
    padding-right: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .row.picked {
    background: rgb(11 107 203 / 0.22);
  }

  .fold {
    width: 16px;
    height: 16px;
    margin-left: -18px;
    margin-right: -6px;
    display: grid;
    place-items: center;
    color: #8f8f8f;
  }

  .type {
    color: #b0b0b0;
  }

  .row.picked .type {
    color: #f2f2f2;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tabs {
    padding: 8px 12px 6px;
    border-bottom: 1px solid #313131;
  }

  .track {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 6px;
    background: #181818;
  }

  .track span {
    flex: 1;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    color: #b0b0b0;
    font-size: 13px;
    font-weight: 500;
  }

  .track .on {
    background: #272727;
    color: #f2f2f2;
    font-weight: 600;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
  }

  .ins-head {
    height: 48px;
    padding: 0 8px 0 16px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 1px solid #313131;
  }

  .kind-icon {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    background: rgb(124 92 255 / 0.16);
    color: #7c5cff;
  }

  .ins-name {
    margin-left: 4px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .ins-kind {
    margin-right: 4px;
    color: rgb(242 242 242 / 0.4);
    font-size: 11px;
  }

  .sec {
    padding: 0 16px 16px;
    display: grid;
    gap: 8px;
    border-bottom: 1px solid #313131;
  }

  .sec-head {
    height: 48px;
    margin: 0 -8px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
  }

  .sec-head + * {
    margin-top: -8px;
  }

  .sec-fold {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    color: rgb(242 242 242 / 0.4);
  }

  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .chip,
  .field {
    height: 32px;
    display: flex;
    align-items: center;
    border-radius: 6px;
    background: #181818;
    white-space: nowrap;
    overflow: hidden;
  }

  .chip-label {
    min-width: 22px;
    padding: 0 4px 0 8px;
    color: rgb(242 242 242 / 0.6);
  }

  .chip-value {
    flex: 1;
    padding: 0 2px;
  }

  .chip-unit {
    padding-right: 6px;
    color: rgb(242 242 242 / 0.4);
  }

  .field {
    padding: 0 10px;
    justify-content: space-between;
  }

  .field .i {
    color: rgb(242 242 242 / 0.4);
  }

  .paint {
    min-height: 40px;
    padding: 4px 0;
    display: grid;
    grid-template-columns: 32px 1fr 24px 24px;
    align-items: center;
    column-gap: 12px;
  }

  .swatch {
    width: 32px;
    height: 32px;
    border: 1px solid #313131;
    border-radius: 6px;
    background: #ff5100;
  }

  .paint-text {
    display: grid;
  }

  .hex {
    font-size: 13px;
    font-weight: 500;
  }

  .meta {
    color: #b0b0b0;
    font-size: 11px;
  }

  .tools {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 12px;
    width: fit-content;
    margin-inline: auto;
    padding: 5px 7px 5px 5px;
    display: flex;
    gap: 2px;
    border-radius: 9999px;
  }

  .tool-group {
    display: flex;
    gap: 2px;
  }

  .tool {
    position: relative;
    min-width: 36px;
    height: 36px;
    padding: 0 9px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    color: #b0b0b0;
  }

  .badge {
    position: absolute;
    right: 7px;
    bottom: 7px;
    width: 8.5px;
    height: 8.5px;
    fill: none;
    stroke: #272727;
    stroke-width: 1.4;
  }

  .badge circle {
    stroke: none;
  }

  .tool-rule {
    width: 1px;
    margin: 6px 2px;
    background: #313131;
  }

  .modes {
    height: 32px;
    margin-block: 2px;
    padding: 2px;
    display: flex;
    border-radius: 9999px;
    background: #181818;
  }

  .mode {
    width: 34px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    color: #b0b0b0;
  }

  .mode.on {
    background: #272727;
    color: #f2f2f2;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
  }

  .zoom {
    position: absolute;
    right: 12px;
    bottom: 12px;
    height: 36px;
    min-width: 56px;
    padding: 0 12px;
    display: grid;
    place-items: center;
    border-radius: 9999px;
  }

  .view {
    height: 28px;
    padding: 0 8px 0 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 9999px;
  }

  .zoom,
  .view {
    color: #b0b0b0;
    font-family: 'Fragment Mono', monospace;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .zoom-value {
    animation-name: zoom-count;
    counter-reset: zoom var(--zoom);
  }

  .zoom-value::after {
    content: counter(zoom) '%';
  }

  @keyframes zoom-count {
    from {
      --zoom: 100;
    }

    to {
      --zoom: var(--end-zoom);
    }
  }

  @media (max-width: 1199.98px) {
    .wide {
      display: none;
    }
  }
</style>
