<script lang="ts">
  import { followDocks } from '$lib/canvas/dock-lift';
  import { localStore } from '$lib/browser-storage';
  import type { Snippet } from 'svelte';
  import Upload from '@lucide/svelte/icons/upload';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import Hash from '@lucide/svelte/icons/hash';
  import { BAR_MODE_KEY, BarContext, BarMode, BarSlot, barHidden, barKeys, barLift, barShift, barShown, barSlots, readBarMode } from '$lib/canvas/bottom-bar';
  import PenTool from '@lucide/svelte/icons/pen-tool';
  import Sparkles from '@lucide/svelte/icons/sparkles';
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
  import { MOBILE_QUERY } from '$lib/breakpoints';
  import { PhoneSheetKind, phoneSheets } from '$lib/canvas/phone-sheets.svelte';
  import PhoneSheet from './PhoneSheet.svelte';

  let {
    onpick,
    onupload,
    ontemplate,
    onframes,
    context = BarContext.Canvas,
    zoom
  }: { onpick?: (what: Addable) => void; onupload?: (file: File) => void; ontemplate?: (id: string) => void; onframes?: () => void; context?: BarContext; zoom?: number } = $props();

  const PERCENT = 100;
  const SWITCH_PX = 64;
  const FRAME_TABS_PX = 56;

  let barEl = $state<HTMLElement | null>(null);
  let timelinePx = $state(0);
  $effect(() => {
    const timeline = frameBar.timeline;
    const host = barEl?.parentElement;
    if (!frameBar.host || !host) {
      timelinePx = 0;
      return;
    }
    const bottomDocks = () => [...(timeline ? [timeline] : []), ...document.querySelectorAll<HTMLElement>('[data-dock="timeline"]')].filter((el) => el !== barEl);
    return followDocks(host, bottomDocks, (px) => {
      if (px !== timelinePx) {
        timelinePx = px;
      }
    });
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

  const TOOL_COMMAND: Record<Exclude<DrawTool, DrawTool.Frame>, Command> = {
    [DrawTool.Select]: Command.ToolSelect,
    [DrawTool.Text]: Command.ToolText,
    [DrawTool.Rectangle]: Command.ToolRectangle,
    [DrawTool.Ellipse]: Command.ToolEllipse,
    [DrawTool.Pen]: Command.ToolPen
  };

  const SHAPE_TOOLS = (Object.entries(TOOL_COMMAND) as [DrawTool, Command][]).map(([tool, command]) => {
    const tip = tipText(command);
    return { tool, name: tip.name, label: `${tip.name} (${tip.keys})`, icon: ACTIONS[command].icon };
  });
  const FRAME_TOOL = { tool: DrawTool.Frame, name: 'Frame', label: 'Frame', icon: Hash };
  const DRAW_TOOLS = $derived(context === BarContext.Canvas ? [...SHAPE_TOOLS, FRAME_TOOL] : SHAPE_TOOLS);

  let drawOpen = $state(false);

  function pickTool(tool: DrawTool) {
    drawOpen = frameBar.tool === tool && !drawOpen;
    frameBar.tool = tool;
  }

  function storedMode(): BarMode {
    try {
      return readBarMode(localStorage.getItem(BAR_MODE_KEY));
    } catch {
      return BarMode.Generate;
    }
  }

  let mode = $state(localStore() ? storedMode() : BarMode.Generate);

  function pickMode(next: BarMode) {
    mode = next;
    showMore = false;
    showTemplates = false;
    try {
      localStorage.setItem(BAR_MODE_KEY, next);
    } catch {
      return;
    }
  }

  const MODES: { mode: BarMode; label: string; icon: typeof PenTool }[] = [
    { mode: BarMode.Design, label: 'Design', icon: PenTool },
    { mode: BarMode.Generate, label: 'Generate', icon: Sparkles }
  ];

  const SELECT_TOOL = SHAPE_TOOLS.find((t) => t.tool === DrawTool.Select)!;

  let phone = $state(typeof matchMedia === 'function' && matchMedia(MOBILE_QUERY).matches);

  $effect(() => {
    const query = matchMedia(MOBILE_QUERY);
    const follow = () => (phone = query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  });

  type Tile = { id: string; label: string; icon: (typeof SHAPE_TOOLS)[number]['icon'] | typeof PenTool; run: () => void };
  type Section = { title: string; tiles: Tile[] };

  const addTile = (what: Addable): Tile => ({ id: what, label: ADDABLE_LABEL[what], icon: ADDABLE_ICON[what], run: () => onpick?.(what) });
  const drawTiles = $derived(DRAW_TOOLS.filter((t) => t.tool !== DrawTool.Select).map((t) => ({ id: `draw-${t.tool}`, label: t.name, icon: t.icon, run: () => (frameBar.tool = t.tool) })));
  const UPLOAD_TILE: Tile = { id: 'upload', label: 'Upload file', icon: Upload, run: pickFile };

  const INSERT_SECTIONS: Record<BarContext, () => Section[]> = {
    [BarContext.Canvas]: () => [
      { title: 'Design', tiles: drawTiles },
      { title: 'Generate', tiles: [...CANVAS_BAR_MAIN, ...visibleUnder(page.data.socialPublishing, SOCIAL_PUBLISHING_SURFACE.addable, CANVAS_BAR_MORE)].map(addTile) },
      { title: 'Media', tiles: [UPLOAD_TILE] },
      {
        title: 'Templates',
        tiles: [
          ...(ontemplate ? [{ id: 'templates', label: 'Templates', icon: LayoutTemplate, run: () => (showTemplates = true) }] : []),
          ...(onframes ? [{ id: 'frame-templates', label: 'Frame templates', icon: Clapperboard, run: onframes }] : [])
        ]
      }
    ],
    [BarContext.Frame]: () => [
      { title: 'Design', tiles: drawTiles },
      { title: 'Media', tiles: [{ id: 'image', label: 'Insert image', icon: ImagePlus, run: () => frameBar.host?.act(FrameAction.Image) }] },
      { title: 'Templates', tiles: [{ id: 'frame-library', label: 'Frame templates', icon: LayoutTemplate, run: () => frameBar.host?.act(FrameAction.Library) }] }
    ]
  };
  const insertSections = $derived(INSERT_SECTIONS[context]().filter((section) => section.tiles.length));

  function insert(tile: Tile) {
    phoneSheets.close(PhoneSheetKind.Insert);
    tile.run();
  }

  const SLOT: Record<BarSlot, Snippet> = {
    [BarSlot.Mode]: modeSlot,
    [BarSlot.Select]: selectSlot,
    [BarSlot.Generate]: nodesSlot,
    [BarSlot.Upload]: uploadSlot,
    [BarSlot.More]: moreSlot,
    [BarSlot.Templates]: templatesSlot,
    [BarSlot.FrameTemplates]: frameTemplatesSlot,
    [BarSlot.Draw]: drawSlot,
    [BarSlot.Image]: imageSlot,
    [BarSlot.FrameLibrary]: frameLibrarySlot
  };
</script>

{#snippet modeSlot()}
  <span class="mode" role="radiogroup" aria-label="Bar tools" data-testid="bar-mode">
    {#each MODES as m (m.mode)}
      <button type="button" role="radio" aria-checked={mode === m.mode} aria-label={m.label} title={m.label} data-mode={m.mode} onclick={() => pickMode(m.mode)}>
        <m.icon size={12} strokeWidth={2} />
      </button>
    {/each}
  </span>
{/snippet}

{#snippet selectSlot()}
  <span class="tool">
    <button type="button" class="pick" class:on={frameBar.tool === DrawTool.Select} aria-pressed={frameBar.tool === DrawTool.Select} aria-label={SELECT_TOOL.label} title={SELECT_TOOL.label} data-tool={DrawTool.Select} onclick={() => (frameBar.tool = DrawTool.Select)}>
      <SELECT_TOOL.icon size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">{SELECT_TOOL.label}</span>
  </span>
{/snippet}

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

<div bind:this={barEl} class="add-bar" class:phone class:covered={barHidden(context, frameBar.covered)} class:stowed={!barShown(context, frameBar.editMode)} aria-hidden={!barShown(context, frameBar.editMode)} inert={!barShown(context, frameBar.editMode)} data-testid="add-bar" data-context={context} data-dock="timeline" {...{ [KEY_REGION_ATTR]: barKeys(context) }} style:--lift={`${barLift(context, timelinePx)}px`} style:--shift={`${barShift(context, frameBar.sidePx)}px`}>
  {#key `${context}:${mode}`}
    <div class="group" data-testid={`bar-${context}`}>
      {#each barSlots(context, mode) as s (s)}{@render SLOT[s]()}{/each}
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

{#if phone}
  <PhoneSheet name="insert" title="Insert" open={phoneSheets.shown === PhoneSheetKind.Insert} onclose={() => phoneSheets.close(PhoneSheetKind.Insert)} floorPx={context === BarContext.Frame ? FRAME_TABS_PX : SWITCH_PX} testid="insert-sheet">
    {#each insertSections as section (section.title)}
      <h4 class="insert-head">{section.title}</h4>
      <div class="insert-grid">
        {#each section.tiles as tile (tile.id)}
          <button type="button" class="insert-tile" data-insert={tile.id} onclick={() => insert(tile)}>
            <tile.icon size={22} strokeWidth={1.6} />
            <span>{tile.label}</span>
          </button>
        {/each}
      </div>
    {/each}
  </PhoneSheet>
{/if}

<style>
  .add-bar.phone {
    display: none;
  }

  .insert-head {
    margin: 12px 8px 6px;
    font-size: var(--ui-type-caption);
    font-weight: var(--ui-weight-semibold);
    color: var(--ui-text-secondary);
  }

  .insert-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px;
  }

  .insert-tile {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 6px;
    min-height: 76px;
    padding: 8px 4px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    text-align: center;
  }

  .insert-tile:active {
    background: var(--ui-pressed);
  }

  .add-bar.covered {
    visibility: hidden;
  }

  .add-bar.stowed {
    opacity: 0;
    pointer-events: none;
  }

  .add-bar {
    position: absolute;
    z-index: 61;
    bottom: var(--lift, 0px);
    left: calc(50% - var(--shift, 0px));
    transform: translateX(-50%);
    transition: bottom var(--chrome-move) var(--ease-expo), left var(--chrome-move) var(--ease-expo), opacity var(--chrome-move) var(--ease-expo), translate var(--chrome-move) var(--ease-expo);
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
      min-width: min(var(--touch-target), calc((100vw - 48px) / 10));
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
  .mode {
    display: inline-flex;
    gap: 1px;
    padding: 2px;
    margin-right: 2px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-wash);
  }

  .mode button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
    color: var(--ui-ink-muted, inherit);
    cursor: pointer;
  }

  @media (max-width: 767px) {
    .mode button {
      width: 22px;
      min-width: 22px;
      min-height: var(--touch-target);
    }
  }

  .mode button[aria-checked='true'] {
    background: var(--ui-panel-raised);
    color: var(--ui-accent);
  }
</style>
