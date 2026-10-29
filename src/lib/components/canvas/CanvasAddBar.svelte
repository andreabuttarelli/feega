<script lang="ts">
  import { LocalOff, isOff } from '$lib/local-user';
  import { followDocks } from '$lib/canvas/dock-lift';
  import type { Snippet } from 'svelte';
  import Upload from '@lucide/svelte/icons/upload';
  import Cloud from '@lucide/svelte/icons/cloud';
  import Frame from '@lucide/svelte/icons/frame';
  import Link from '@lucide/svelte/icons/link';
  import CodeXml from '@lucide/svelte/icons/code-xml';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import Film from '@lucide/svelte/icons/film';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import Plus from '@lucide/svelte/icons/plus';
  import { DockPlace, toolsIn } from '$lib/canvas/draw-dock';
  import { BAR_SLOTS, BarContext, BarSlot } from '$lib/canvas/bottom-bar';
  import { INSERT_SECTION_TITLE, InsertSection, insertSections } from '$lib/canvas/insert-menu';
  import { frameBar } from '$lib/canvas/frame-bar.svelte';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { Command } from '$lib/motion/shortcuts';
  import { ACTIONS } from '$lib/motion/actions';
  import { canvasToolKeys } from '$lib/canvas/shortcuts';
  import CanvasTemplateGallery from './CanvasTemplateGallery.svelte';
  import { CANVAS_ADD_BAR, CLOUD_ADDABLE, AI_ADDABLE, ADDABLE_LABEL, type Addable } from '$lib/canvas/addable';
  import { ADDABLE_ICON } from '$lib/canvas/addable-icons';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import { MOBILE_QUERY } from '$lib/breakpoints';
  import { PhoneSheetKind, phoneSheets } from '$lib/canvas/phone-sheets.svelte';
  import PhoneSheet from './PhoneSheet.svelte';
  import { EditorMode, MODES, editorMode } from '$lib/canvas/editor-mode.svelte';
  import ProviderIcon from './ProviderIcon.svelte';
  import { hotDrag, type HotModel } from '$lib/canvas/hot-models';
  import { CANVAS_DRAG_FILLED_NODE } from '$lib/canvas/drag-payload';

  let {
    onpick,
    models = [],
    onmodel,
    onupload,
    oncloud,
    onfigma,
    onurl,
    oncode,
    ontemplate,
    techniques = [],
    ontechnique,
    onframes,
    ontrailer,
    onimage,
    onframelibrary,
    oncomment,
    commenting = false,
    context = BarContext.Canvas,
    zoom
  }: {
    onpick?: (what: Addable) => void;
    models?: HotModel[];
    onmodel?: (model: HotModel) => void;
    onupload?: (file: File) => void;
    oncloud?: () => void;
    onfigma?: () => void;
    onurl?: () => void;
    oncode?: () => void;
    ontemplate?: (id: string) => void;
    techniques?: { id: string; name: string; nodes: number }[];
    ontechnique?: (id: string) => void;
    onframes?: () => void;
    ontrailer?: () => void;
    onimage?: (file: File) => void;
    onframelibrary?: () => void;
    oncomment?: () => void;
    commenting?: boolean;
    context?: BarContext;
    zoom?: number;
  } = $props();

  const PERCENT = 100;
  const SWITCH_PX = 64;
  const INSERT_LABEL = 'Insert';
  const MODE_SHORTCUT: Partial<Record<EditorMode, string>> = {
    [EditorMode.Design]: 'E',
    [EditorMode.Motion]: 'E',
    [EditorMode.Code]: '⇧D'
  };
  const modeTip = (mode: EditorMode) => (MODE_SHORTCUT[mode] ? `${MODES[mode].label} (${MODE_SHORTCUT[mode]})` : MODES[mode].label);

  let barEl = $state<HTMLElement | null>(null);
  let timelinePx = $state(0);
  $effect(() => {
    const timeline = frameBar.timeline;
    const host = barEl?.parentElement;
    if (!host) {
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

  let menuOpen = $state(false);
  let showTemplates = $state(false);

  $effect(() => {
    void context;
    menuOpen = false;
    showTemplates = false;
  });

  $effect(() => {
    if (!menuOpen) {
      return;
    }
    const closeOutside = (e: PointerEvent) => {
      if (!barEl?.contains(e.target as Node)) {
        menuOpen = false;
      }
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        menuOpen = false;
      }
    };
    window.addEventListener('pointerdown', closeOutside, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  });

  function pickTechnique(id: string) {
    showTemplates = false;
    ontechnique?.(id);
  }

  function pickTemplate(id: string) {
    showTemplates = false;
    ontemplate?.(id);
  }

  const offered = (what: Addable) => !(isOff(LocalOff.CloudNodes) && CLOUD_ADDABLE.has(what)) && !(isOff(LocalOff.AiNodes) && AI_ADDABLE.has(what));
  const slot = (what: Addable) => CANVAS_ADD_BAR.indexOf(what) + 1;

  let fileInput = $state<HTMLInputElement | null>(null);

  function pickFile() {
    fileInput?.click();
  }

  function fileChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      onupload?.(file);
    }
    input.value = '';
  }

  let imageInput = $state<HTMLInputElement | null>(null);

  function pickImage() {
    imageInput?.click();
  }

  function imageChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      onimage?.(file);
    }
    input.value = '';
  }

  const TOOL_COMMAND: Record<DrawTool, Command> = {
    [DrawTool.Select]: Command.ToolSelect,
    [DrawTool.Text]: Command.ToolText,
    [DrawTool.Rectangle]: Command.ToolRectangle,
    [DrawTool.Ellipse]: Command.ToolEllipse,
    [DrawTool.Polygon]: Command.ToolPolygon,
    [DrawTool.Star]: Command.ToolStar,
    [DrawTool.Line]: Command.ToolLine,
    [DrawTool.Arrow]: Command.ToolArrow,
    [DrawTool.Pen]: Command.ToolPen,
    [DrawTool.Pencil]: Command.ToolPencil,
    [DrawTool.ShapeBuilder]: Command.ToolShapeBuilder,
    [DrawTool.Frame]: Command.ToolFrame
  };

  const DRAW_TOOLS = (Object.entries(TOOL_COMMAND) as [DrawTool, Command][]).map(([tool, command]) => {
    const name = ACTIONS[command].name;
    const keys = canvasToolKeys(command);
    return { tool, name, keys, label: keys ? `${name} (${keys})` : name, icon: ACTIONS[command].icon };
  });
  const toolOf = (tool: DrawTool) => DRAW_TOOLS.find((t) => t.tool === tool)!;
  const MENU_TOOLS = [...toolsIn(DockPlace.Bar), ...toolsIn(DockPlace.More)].filter((tool) => tool !== DrawTool.Select).map(toolOf);
  const SELECT_TOOL = toolOf(DrawTool.Select);

  let phone = $state(typeof matchMedia === 'function' && matchMedia(MOBILE_QUERY).matches);

  $effect(() => {
    const query = matchMedia(MOBILE_QUERY);
    const follow = () => (phone = query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  });

  type Tile = { id: string; label: string; icon: (typeof DRAW_TOOLS)[number]['icon'] | typeof Plus; run: () => void; hint?: string; drag?: Addable; tool?: DrawTool; model?: HotModel };

  const addTile = (what: Addable): Tile => ({ id: what, label: ADDABLE_LABEL[what], hint: `${ADDABLE_LABEL[what]} (${slot(what)})`, icon: ADDABLE_ICON[what], run: () => onpick?.(what), drag: what });
  const toolTile = (t: (typeof DRAW_TOOLS)[number]): Tile => ({ id: `draw-${t.tool}`, label: t.name, hint: t.label, icon: t.icon, run: () => (frameBar.tool = t.tool), tool: t.tool });
  const modelTile = (m: HotModel): Tile => ({ id: `model-${m.id}`, label: m.label, hint: m.label, icon: Plus, run: () => onmodel?.(m), model: m });
  const optional = (tile: Tile, shown: unknown): Tile[] => (shown ? [tile] : []);

  const SECTION_TILES: Record<InsertSection, () => Tile[]> = {
    [InsertSection.Tools]: () => MENU_TOOLS.map(toolTile),
    [InsertSection.Generate]: () => CANVAS_ADD_BAR.filter(offered).map(addTile),
    [InsertSection.Models]: () => models.map(modelTile),
    [InsertSection.Import]: () => [
      { id: 'upload', label: 'Upload file', icon: Upload, run: pickFile },
      ...optional({ id: 'cloud', label: 'Import from Drive or Dropbox', icon: Cloud, run: () => oncloud?.() }, oncloud),
      ...optional({ id: 'figma', label: 'Import from Figma', icon: Frame, run: () => onfigma?.() }, onfigma),
      ...optional({ id: 'url', label: 'From URL…', icon: Link, run: () => onurl?.() }, onurl),
      ...optional({ id: 'code', label: 'From code…', icon: CodeXml, run: () => oncode?.() }, oncode)
    ],
    [InsertSection.Templates]: () => [
      ...optional({ id: 'templates', label: 'Templates', icon: LayoutTemplate, run: () => (showTemplates = true) }, ontemplate),
      ...optional({ id: 'frame-templates', label: 'Frame templates', icon: Clapperboard, run: () => onframes?.() }, onframes),
      ...optional({ id: 'feega-trailer', label: 'Start from the Feega trailer', icon: Film, run: () => ontrailer?.() }, ontrailer)
    ],
    [InsertSection.Frame]: () => [
      { id: 'image', label: 'Insert image', icon: ImagePlus, run: pickImage },
      ...optional({ id: 'frame-library', label: 'Templates for this frame', icon: LayoutTemplate, run: () => onframelibrary?.() }, onframelibrary)
    ]
  };

  const sections = $derived(
    insertSections(context)
      .map((section) => ({ section, title: INSERT_SECTION_TITLE[section], tiles: SECTION_TILES[section]() }))
      .filter((s) => s.tiles.length)
  );

  function insert(tile: Tile) {
    menuOpen = false;
    phoneSheets.close(PhoneSheetKind.Insert);
    tile.run();
  }

  function startDrag(e: DragEvent, tile: Tile) {
    if (tile.model) {
      e.dataTransfer?.setData(CANVAS_DRAG_FILLED_NODE, JSON.stringify(hotDrag(tile.model)));
      return;
    }
    if (!tile.drag) {
      return;
    }
    e.dataTransfer?.setData(CANVAS_DRAG_MEDIUM, tile.drag);
  }

  const SLOT: Record<BarSlot, Snippet> = {
    [BarSlot.Select]: selectSlot,
    [BarSlot.Insert]: insertSlot,
    [BarSlot.Comment]: commentSlot
  };
</script>

{#snippet selectSlot()}
  <span class="tool">
    <button type="button" class="pick" class:on={frameBar.tool === DrawTool.Select} aria-pressed={frameBar.tool === DrawTool.Select} aria-label={SELECT_TOOL.label} title={SELECT_TOOL.label} data-tool={DrawTool.Select} onclick={() => (frameBar.tool = DrawTool.Select)}>
      <SELECT_TOOL.icon size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">{SELECT_TOOL.label}</span>
  </span>
{/snippet}

{#snippet insertSlot()}
  <span class="tool">
    <button type="button" class="pick" class:on={menuOpen} aria-label={INSERT_LABEL} aria-haspopup="menu" aria-expanded={menuOpen} data-testid="insert-open" onclick={() => (menuOpen = !menuOpen)}>
      <Plus size={18} strokeWidth={1.8} />
    </button>
    {#if !menuOpen}<span class="add-tip" role="tooltip">{INSERT_LABEL}</span>{/if}
  </span>
{/snippet}

{#snippet modeSlot()}
  <div class="group modes" role="group" aria-label="Editor mode" data-testid="editor-mode-switch" data-mode={editorMode.current}>
    {#each Object.values(EditorMode) as mode (mode)}
      {@const Icon = MODES[mode].icon}
      <span class="tool">
        <button type="button" class="pick" class:on={editorMode.current === mode} aria-pressed={editorMode.current === mode} aria-label={MODES[mode].label} data-mode={mode} onclick={() => editorMode.set(mode)}>
          <Icon size={17} strokeWidth={1.7} />
        </button>
        <span class="add-tip" role="tooltip">{modeTip(mode)}</span>
      </span>
    {/each}
  </div>
  <span class="mode-divider" aria-hidden="true"></span>
{/snippet}

{#snippet commentSlot()}
  {#if oncomment}
    <span class="tool">
      <button type="button" class="pick" class:on={commenting} aria-pressed={commenting} title="Comment (C)" aria-label="Comment" data-testid="comment-mode" onclick={oncomment}>
        <MessageCircle size={17} strokeWidth={1.7} />
      </button>
      <span class="add-tip" role="tooltip">Comment (C)</span>
    </span>
  {/if}
{/snippet}

{#snippet insertMenu()}
  {#each sections as s (s.section)}
    <h4 class="insert-head">{s.title}</h4>
    <div class="insert-grid" data-section={s.section}>
      {#each s.tiles as tile (tile.id)}
        <button
          type="button"
          role="menuitem"
          class="insert-tile"
          class:on={tile.tool !== undefined && frameBar.tool === tile.tool}
          data-insert={tile.id}
          data-tool={tile.tool}
          title={tile.hint ?? tile.label}
          draggable={tile.drag || tile.model ? 'true' : undefined}
          ondragstart={(e) => startDrag(e, tile)}
          ondragend={() => (menuOpen = false)}
          onclick={() => insert(tile)}
        >
          {#if tile.model}
            <ProviderIcon provider={tile.model.logo} size={20} />
          {:else}
            <tile.icon size={20} strokeWidth={1.6} />
          {/if}
          <span>{tile.label}</span>
        </button>
      {/each}
    </div>
  {/each}
{/snippet}

<div bind:this={barEl} class="add-bar" class:phone data-testid="add-bar" data-context={context} data-dock="timeline" style:--lift={`${timelinePx}px`}>
  {#if !phone}{@render modeSlot()}{/if}
  <div class="group" data-testid={`bar-${context}`}>
    {#each BAR_SLOTS as s (s)}{@render SLOT[s]()}{/each}
  </div>
  {#if zoom !== undefined}
    <span class="zoom" data-testid="canvas-zoom" title="Zoom · 0 fits the canvas">{Math.round(zoom * PERCENT)}%</span>
  {/if}
  <input bind:this={imageInput} type="file" class="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" data-testid="frame-image-input" onchange={imageChosen} />
  <input
    bind:this={fileInput}
    type="file"
    class="sr-only"
    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,.svg,.json,.lottie,video/mp4,video/webm,video/quicktime,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,text/html,text/csv,text/plain,text/markdown,.xml,.rss,.atom,.ipynb,.ttf,.otf,.woff,.woff2"
    onchange={fileChosen}
  />

  {#if ontemplate}
    <CanvasTemplateGallery bind:open={showTemplates} onpick={pickTemplate} {techniques} onpicktechnique={ontechnique ? pickTechnique : undefined} />
  {/if}

  {#if menuOpen && !phone}
    <div class="insert-menu" role="menu" aria-label={INSERT_LABEL} data-testid="insert-menu">
      {@render insertMenu()}
    </div>
  {/if}
</div>

{#if phone}
  <PhoneSheet name="insert" title={INSERT_LABEL} open={phoneSheets.shown === PhoneSheetKind.Insert} onclose={() => phoneSheets.close(PhoneSheetKind.Insert)} floorPx={SWITCH_PX} testid="insert-sheet">
    {@render insertMenu()}
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

  .insert-tile.on {
    background: var(--ui-selected);
    color: var(--ui-accent-text);
  }

  .insert-menu {
    position: absolute;
    z-index: 14;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    width: min(440px, calc(100vw - 32px));
    max-height: min(560px, 70vh);
    overflow-y: auto;
    padding: 4px 10px 10px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .insert-menu .insert-tile {
    height: auto;
    min-height: 72px;
    cursor: pointer;
  }

  .insert-menu .insert-tile[draggable='true'] {
    cursor: grab;
  }

  .add-bar {
    position: absolute;
    z-index: 61;
    bottom: calc(var(--lift, 0px) + 12px);
    left: 50%;
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


  .pick {
    cursor: pointer;
  }

  .mode-divider {
    align-self: stretch;
    margin: 6px 4px;
    border-left: 1px solid var(--ui-divider);
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
    button:active {
      background: var(--ui-wash);
    }
    .add-tip {
      display: none;
    }
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




</style>
