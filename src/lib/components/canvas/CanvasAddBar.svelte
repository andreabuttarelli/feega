<script lang="ts">
  import type { Snippet } from 'svelte';
  import Upload from '@lucide/svelte/icons/upload';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import { BAR_SLOTS, BarContext, BarSlot, barHidden, barKeys, barLift, barShift } from '$lib/canvas/bottom-bar';
  import { KEY_REGION_ATTR } from '$lib/canvas/key-region.svelte';
  import { FrameAction, frameBar } from '$lib/canvas/frame-bar.svelte';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { Command } from '$lib/motion/shortcuts';
  import { ACTIONS, tipText } from '$lib/motion/actions';
  import CanvasTemplateGallery from './CanvasTemplateGallery.svelte';
  import { CANVAS_ADD_BAR, CANVAS_BAR_MAIN, CANVAS_BAR_MORE, ADDABLE_LABEL, type Addable } from '$lib/canvas/addable';
  import { ADDABLE_ICON } from '$lib/canvas/addable-icons';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import { page } from '$app/state';
  import { SOCIAL_PUBLISHING_SURFACE, visibleUnder } from '$lib/social-publishing';

  let {
    onpick,
    onupload,
    ontemplate,
    onframes,
    context = BarContext.Canvas,
    zoom
  }: { onpick?: (what: Addable) => void; onupload?: (file: File) => void; ontemplate?: (id: string) => void; onframes?: () => void; context?: BarContext; zoom?: number } = $props();

  const PERCENT = 100;

  let barEl = $state<HTMLElement | null>(null);
  let timelinePx = $state(0);
  $effect(() => {
    const timeline = frameBar.timeline;
    const host = barEl?.parentElement;
    if (!timeline || !host) {
      timelinePx = 0;
      return;
    }
    let frame = 0;
    const follow = () => {
      const rect = timeline.getBoundingClientRect();
      const px = rect.height ? Math.max(0, Math.round(host.getBoundingClientRect().bottom - rect.top)) : 0;
      if (px !== timelinePx) {
        timelinePx = px;
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  });

  let showMore = $state(false);
  let showTemplates = $state(false);

  $effect(() => {
    void context;
    showMore = false;
    showTemplates = false;
  });

  function pickTemplate(id: string) {
    showTemplates = false;
    ontemplate?.(id);
  }

  const slot = (what: Addable) => CANVAS_ADD_BAR.indexOf(what) + 1;

  function pickMore(what: Addable) {
    showMore = false;
    onpick?.(what);
  }
  let fileInput = $state<HTMLInputElement | null>(null);

  function pickFile() {
    fileInput?.click();
  }

  function fileChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) { onupload?.(file); }
    input.value = '';
  }

  const TOOL_COMMAND: Record<DrawTool, Command> = {
    [DrawTool.Select]: Command.ToolSelect,
    [DrawTool.Text]: Command.ToolText,
    [DrawTool.Rectangle]: Command.ToolRectangle,
    [DrawTool.Ellipse]: Command.ToolEllipse,
    [DrawTool.Pen]: Command.ToolPen
  };

  const DRAW_TOOLS = Object.values(DrawTool).map((tool) => {
    const tip = tipText(TOOL_COMMAND[tool]);
    return { tool, name: tip.name, label: `${tip.name} (${tip.keys})`, icon: ACTIONS[TOOL_COMMAND[tool]].icon };
  });

  let drawOpen = $state(false);

  function pickTool(tool: DrawTool) {
    drawOpen = frameBar.tool === tool && !drawOpen;
    frameBar.tool = tool;
  }

  const SLOT: Record<BarSlot, Snippet> = {
    [BarSlot.Upload]: uploadSlot,
    [BarSlot.Nodes]: nodesSlot,
    [BarSlot.More]: moreSlot,
    [BarSlot.Templates]: templatesSlot,
    [BarSlot.FrameTemplates]: frameTemplatesSlot,
    [BarSlot.Draw]: drawSlot,
    [BarSlot.Image]: imageSlot,
    [BarSlot.FrameLibrary]: frameLibrarySlot
  };
</script>

{#snippet uploadSlot()}
  <span class="tool">
    <button type="button" title="Upload file" aria-label="Upload file" onclick={pickFile}>
      <Upload size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">Upload file</span>
  </span>
{/snippet}

{#snippet nodesSlot()}
  {#each CANVAS_BAR_MAIN as what (what)}
    {@const Icon = ADDABLE_ICON[what]}
    <span class="tool">
      <button
        type="button"
        title={`${ADDABLE_LABEL[what]} (${slot(what)})`}
        aria-label={ADDABLE_LABEL[what]}
        draggable="true"
        onclick={() => onpick?.(what)}
        ondragstart={(e) => e.dataTransfer?.setData(CANVAS_DRAG_MEDIUM, what)}
      >
        <Icon size={17} strokeWidth={1.7} />
      </button>
      <span class="add-tip" role="tooltip">{ADDABLE_LABEL[what]}</span>
    </span>
  {/each}
{/snippet}

{#snippet moreSlot()}
  <span class="tool">
    <button
      type="button"
      class="keys-toggle"
      title="More nodes"
      aria-label="More nodes"
      aria-expanded={showMore}
      onclick={() => {
        showMore = !showMore;
        showTemplates = false;
      }}
    >
      <LayoutGrid size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">More nodes</span>
  </span>
{/snippet}

{#snippet templatesSlot()}
  {#if ontemplate}
    <span class="tool">
      <button
        type="button"
        class="keys-toggle"
        title="Templates"
        aria-label="Templates"
        aria-expanded={showTemplates}
        onclick={() => {
          showTemplates = !showTemplates;
          showMore = false;
        }}
      >
        <LayoutTemplate size={17} strokeWidth={1.7} />
      </button>
      <span class="add-tip" role="tooltip">Templates</span>
    </span>
  {/if}
{/snippet}

{#snippet frameTemplatesSlot()}
  {#if onframes}
    <span class="tool">
      <button type="button" class="keys-toggle" title="Frame templates" aria-label="Frame templates" data-testid="frame-templates" onclick={onframes}>
        <Clapperboard size={17} strokeWidth={1.7} />
      </button>
      <span class="add-tip" role="tooltip">Frame templates</span>
    </span>
  {/if}
{/snippet}

{#snippet drawSlot()}
  <span class="draw" class:open={drawOpen} role="toolbar" aria-label="Draw" data-testid="draw-tools">
    {#each DRAW_TOOLS as t (t.tool)}
      <span class="tool">
        <button type="button" class="pick" class:on={frameBar.tool === t.tool} aria-pressed={frameBar.tool === t.tool} aria-label={t.label} title={t.label} data-tool={t.tool} onclick={() => pickTool(t.tool)}>
          <t.icon size={17} strokeWidth={1.7} />
        </button>
        <span class="add-tip" role="tooltip">{t.label}</span>
      </span>
    {/each}
  </span>
{/snippet}

{#snippet imageSlot()}
  <span class="tool">
    <button type="button" class="keys-toggle" title="Insert image" aria-label="Insert image" data-testid="frame-image" onclick={() => frameBar.host?.act(FrameAction.Image)}>
      <ImagePlus size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">Insert image</span>
  </span>
{/snippet}

{#snippet frameLibrarySlot()}
  <span class="tool">
    <button type="button" class="keys-toggle" title="Frame templates" aria-label="Frame templates" data-testid="frame-library" onclick={() => frameBar.host?.act(FrameAction.Library)}>
      <LayoutTemplate size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">Frame templates</span>
  </span>
{/snippet}

<div bind:this={barEl} class="add-bar" class:covered={barHidden(context, frameBar.covered)} data-testid="add-bar" data-context={context} data-dock="timeline" {...{ [KEY_REGION_ATTR]: barKeys(context) }} style:--lift={`${barLift(context, timelinePx)}px`} style:--shift={`${barShift(context, frameBar.sidePx)}px`}>
  {#key context}
    <div class="group" data-testid={`bar-${context}`}>
      {#each BAR_SLOTS[context] as s (s)}{@render SLOT[s]()}{/each}
    </div>
  {/key}
  {#if zoom !== undefined && context === BarContext.Canvas}
    <span class="zoom" data-testid="canvas-zoom" title="Zoom · 0 fits the canvas">{Math.round(zoom * PERCENT)}%</span>
  {/if}
  <input
    bind:this={fileInput}
    type="file"
    class="sr-only"
    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,text/html,text/csv,text/plain,text/markdown,.xml,.rss,.atom,.ipynb"
    onchange={fileChosen}
  />

  {#if ontemplate}
    <CanvasTemplateGallery bind:open={showTemplates} onpick={pickTemplate} />
  {/if}

  {#if showMore}
    <div class="more">
      {#each visibleUnder(page.data.socialPublishing, SOCIAL_PUBLISHING_SURFACE.addable, CANVAS_BAR_MORE) as what (what)}
        {@const Icon = ADDABLE_ICON[what]}
        <button
          type="button"
          class="more-item"
          title={`${ADDABLE_LABEL[what]} (${slot(what)})`}
          draggable="true"
          onclick={() => pickMore(what)}
          ondragstart={(e) => e.dataTransfer?.setData(CANVAS_DRAG_MEDIUM, what)}
          ondragend={() => (showMore = false)}
        >
          <Icon size={20} strokeWidth={1.6} />
          <span>{ADDABLE_LABEL[what]}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .add-bar.covered {
    visibility: hidden;
  }

  .add-bar {
    position: absolute;
    z-index: 61;
    bottom: var(--lift, 0px);
    left: calc(50% - var(--shift, 0px));
    transform: translateX(-50%);
    transition: bottom var(--chrome-move) var(--ease-expo), left var(--chrome-move) var(--ease-expo);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 5px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
    animation: bar-in 240ms var(--ease-expo-out);
  }

  .draw {
    display: inline-flex;
    gap: 2px;
    padding-right: 4px;
    margin-right: 4px;
    border-right: 1px solid var(--ui-divider);
  }

  .pick {
    cursor: pointer;
  }

  .zoom {
    display: inline-flex;
    align-items: center;
    height: 36px;
    margin-left: 4px;
    padding: 0 12px 0 10px;
    border-left: 1px solid var(--ui-divider);
    font-family: var(--ui-mono);
    font-size: var(--ui-type-caption);
    color: var(--ui-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 767px) {
    .zoom {
      display: none;
    }
  }

  .pick.on {
    color: var(--ui-accent-text);
    background: var(--ui-selected);
  }

  @keyframes bar-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .add-bar {
      transition: none;
    }
    .group {
      animation: none;
    }
  }

  .tool {
    position: relative;
    display: inline-flex;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 9px;
    font: inherit;
    color: var(--ui-icon-ink);
    background: none;
    border: none;
    border-radius: var(--ui-radius-full);
    cursor: grab;
    transition: background-color var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }
  button:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }
  button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
  button:active {
    cursor: grabbing;
  }

  @media (max-width: 767px) {
    .draw:not(.open) .tool:not(:has(.pick.on)) {
      display: none;
    }
    .group:has(.draw.open) > :not(.draw),
    .add-bar:has(.draw.open) .zoom {
      display: none;
    }
    .draw.open {
      border-right: 0;
      margin-right: 0;
      padding-right: 0;
    }
    .add-bar {
      left: 50%;
      bottom: calc(var(--mobile-bar-inset) + env(safe-area-inset-bottom, 0px) + var(--lift, 0px));
      gap: 0;
      padding: var(--mobile-bar-pad);
      box-shadow: var(--mobile-bar-shadow);
    }
    button {
      min-width: var(--touch-target);
      min-height: var(--touch-target);
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    button:hover {
      background: none;
    }
    button:active,
    .keys-toggle[aria-expanded='true'] {
      background: var(--ui-wash);
    }
    .add-tip {
      display: none;
    }
    .add-bar .more {
      left: 50%;
      transform: translateX(-50%);
      grid-template-columns: repeat(3, minmax(88px, 1fr));
      max-width: calc(100vw - 2 * var(--mobile-bar-inset));
    }
    .add-bar .more-item {
      font-size: 13px;
      min-height: var(--touch-target);
    }
  }

  .keys-toggle {
    cursor: pointer;
    color: var(--ui-text-secondary);
  }

  .add-tip {
    position: absolute;
    z-index: 13;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    white-space: nowrap;
    font-size: var(--ui-type-label);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-tooltip-ink);
    background: var(--ui-tooltip);
    border-radius: var(--ui-radius-sm);
    box-shadow: var(--ui-shadow-raised);
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }
  .tool:hover .add-tip,
  .tool:focus-within .add-tip {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .add-tip {
      transition: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .more {
    position: absolute;
    z-index: 13;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: repeat(3, 96px);
    gap: 4px;
    padding: 6px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }
  .more-item {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 12px 6px;
    height: auto;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-secondary);
    text-align: center;
  }
</style>
