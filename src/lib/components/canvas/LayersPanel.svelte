<script lang="ts">
  import { localStore } from '$lib/browser-storage';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import Square from '@lucide/svelte/icons/square';
  import ImageIcon from '@lucide/svelte/icons/image';
  import TypeIcon from '@lucide/svelte/icons/type';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Shapes from '@lucide/svelte/icons/shapes';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Music from '@lucide/svelte/icons/music';
  import Component from '@lucide/svelte/icons/component';
  import Rows3 from '@lucide/svelte/icons/rows-3';
  import Contrast from '@lucide/svelte/icons/contrast';
  import { ACTIONS, shortcutOf } from '$lib/motion/actions';
  import { readFolds, toggleFold } from '$lib/canvas/layer-folds';
  import { layersSource } from '$lib/canvas/layers-source.svelte';
  import { untrack } from 'svelte';
  import { PART_SEP } from '$lib/motion/poster-parts';
  import { HEADS_PARAM, PARTS_PARAM, cacheOutlines, canvasHeads, headKey, headsParam, missingHeads, outlinesFor, partIds, partsParam, posterHeads, type FrameHead, type OutlineCache } from '$lib/canvas/frame-outlines';
  import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
  import PartsProbe from './PartsProbe.svelte';
  import { rowWindow } from '$lib/canvas/row-window';
  import { IconButton, IconSize, Kbd, MENU_CONTENT, MENU_ITEM } from '$lib/components/ui/shell';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import { Density, ROW_STEP_PX } from '$lib/canvas/layer-density';
  import { LAYER_MENU, LayerAction, LayerKind, NodeIcon, Pick, type Place, dropLayers, dropPlace, frameRows, layerEdit, layerKey, layerRows, pickFor, pickLayers, rowPicked, rowsInside, searchRows, selectedLayers, type LayerRow } from '$lib/canvas/layers';

  const ICON = 14;
  const PRECOMP = 'Precomp';
  const INDENT_PX = 14;
  const FOLD_GUTTER = 24;
  const PROBE_LANES = 6;
  let { density = Density.Pointer }: { density?: Density } = $props();
  const rowStep = $derived(ROW_STEP_PX[density]);
  const OVERSCAN = 8;
  const FALLBACK_VIEW_PX = 1000;

  const canvas = $derived(layersSource.canvas);
  const video = $derived(layersSource.video);
  const heads = $derived(canvasHeads(canvas?.nodes ?? []));
  let outlines = $state.raw<OutlineCache>({});
  const known = $derived(outlines);
  let opening = $state<{ nodeId: string; id: string } | null>(null);
  let folds = $state.raw<Set<string>>(localStore() ? readFolds(localStore()!) : new Set());

  const rows = $derived(layerRows(canvas?.nodes ?? [], video ? { nodeId: video.nodeId, doc: video.doc, parts: video.parts, mode: video.mode } : null, outlinesFor(heads, known), folds));
  const elements = $derived(new Set((canvas?.nodes ?? []).filter((n) => n.element).map((n) => n.id)));
  const frames = $derived(new Set([...heads.map((h) => h.nodeId), ...(video ? [video.nodeId] : [])].filter((id) => !elements.has(id))));
  const fold = (nodeId: string) => (folds = toggleFold(localStorage, folds, nodeId));

  let probed = $state.raw<ReadonlySet<string>>(new Set());
  const probing = $derived(canvas ? posterHeads(heads, known, probed, video?.nodeId ?? null).slice(0, PROBE_LANES) : []);

  function measured(head: FrameHead, boxes: Record<string, MeasuredBox>) {
    probed = new Set([...probed, headKey(head)]);
    const parts = partIds(boxes);
    const url = canvas?.outlinesUrl;
    if (!url || !Object.keys(parts).length) {
      return;
    }
    const query = `${HEADS_PARAM}=${encodeURIComponent(headsParam([head]))}&${PARTS_PARAM}=${encodeURIComponent(partsParam(head.nodeId, parts))}`;
    void fetch(`${url}?${query}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((answer) => (outlines = cacheOutlines(outlines, [head], answer)))
      .catch(() => {});
  }

  $effect(() => {
    const url = canvas?.outlinesUrl;
    const missing = missingHeads(heads, untrack(() => known));
    if (!url || !missing.length) {
      return;
    }
    void fetch(`${url}?${HEADS_PARAM}=${encodeURIComponent(headsParam(missing))}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((answer) => (outlines = cacheOutlines(outlines, missing, answer)))
      .catch(() => {});
  });

  $effect(() => {
    if (!opening || video?.nodeId !== opening.nodeId) {
      return;
    }
    const { id } = opening;
    opening = null;
    untrack(() => pickChild(id));
  });

  function pickChild(id: string) {
    const at = id.indexOf(PART_SEP);
    if (at >= 0) {
      video?.selectPart(id.slice(0, at), id.slice(at + 1));
      return;
    }
    video?.select([id]);
  }
  const selection = $derived({ canvas: canvas?.selected ?? [], video: video ? { nodeId: video.nodeId, selection: video.selection, part: video.part } : null });
  const picked = $derived(selectedLayers(selection));
  let list = $state<HTMLDivElement | null>(null);

  let view = $state({ scrollTop: 0, height: FALLBACK_VIEW_PX });
  let listTop = 0;

  $effect(() => {
    const scroller = list?.parentElement;
    if (!list || !scroller) {
      return;
    }
    const read = () => (view = { scrollTop: scroller.scrollTop - listTop, height: scroller.clientHeight });
    const place = () => {
      listTop = list!.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      read();
    };
    const sizes = new ResizeObserver(place);
    sizes.observe(scroller);
    scroller.addEventListener('scroll', read, { passive: true });
    place();
    return () => {
      sizes.disconnect();
      scroller.removeEventListener('scroll', read);
    };
  });

  $effect(() => {
    const first = picked[0];
    const scroller = list?.parentElement;
    if (!first || !list || !scroller) {
      return;
    }
    const row = list.querySelector<HTMLElement>(`[data-layer="${CSS.escape(first)}"][aria-selected="true"]`);
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
      return;
    }
    const index = untrack(() => shown.findIndex((r) => r.id === first));
    if (index >= 0) {
      scroller.scrollTop = listTop + index * rowStep - scroller.clientHeight / 2;
    }
  });

  let renaming = $state<string | null>(null);
  let dragged = $state<string | null>(null);
  let block = $state<string[]>([]);
  let landing = $state<{ key: string; place: Place } | null>(null);

  function over(row: LayerRow, e: DragEvent) {
    if (!dragged || !editable(row) || block.includes(row.id)) {
      landing = null;
      return;
    }
    e.preventDefault();
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    landing = { key: row.key, place: dropPlace(row.kind, (e.clientY - box.top) / box.height) };
  }

  const ROW_ICON: Record<string, typeof Square> = { [NodeIcon.Video]: Clapperboard, [NodeIcon.Still]: ImageIcon, image: ImageIcon, text: TypeIcon, arrow: ArrowRight, shape: Shapes, Audio: Music };
  const KIND_ICON: Partial<Record<LayerKind, typeof Square>> = { [LayerKind.Group]: Component, [LayerKind.Track]: Rows3, [LayerKind.Mask]: Contrast };
  const EYE_LABEL: Record<'mask' | 'layer', [string, string]> = { mask: ['Turn mask off', 'Turn mask on'], layer: ['Hide', 'Show'] };
  const eyeLabel = (row: LayerRow) => EYE_LABEL[row.kind === LayerKind.Mask ? 'mask' : 'layer'][row.hidden ? 1 : 0];
  const isPicked = (row: LayerRow) => rowPicked(row, selection);
  const inside = $derived(rowsInside(rows, isPicked));
  let query = $state('');
  const shown = $derived(searchRows(rows, query));
  const span = $derived(rowWindow({ ...view, count: shown.length, rowPx: rowStep, overscan: OVERSCAN }));
  const visible = $derived(shown.slice(span.start, span.end));
  const ROW_HUE: Record<string, string> = { motion: 'var(--ui-type-frame)', image: 'var(--ui-type-media)', video: 'var(--ui-type-media)', text: 'var(--ui-type-text)' };
  const editable = (row: LayerRow) => row.kind !== LayerKind.Node && !row.nested;

  const pickOf = (e: MouseEvent | KeyboardEvent): Pick => pickFor({ shift: e.shiftKey, mod: e.metaKey || e.ctrlKey });

  function choose(row: LayerRow, e: MouseEvent) {
    if (row.kind !== LayerKind.Node && video?.nodeId !== row.nodeId) {
      opening = { nodeId: row.nodeId, id: row.id };
      canvas?.select([row.nodeId]);
      return;
    }
    if (row.kind === LayerKind.Part) {
      const at = row.id.indexOf(PART_SEP);
      video?.selectPart(row.id.slice(0, at), row.id.slice(at + 1));
      return;
    }
    if (row.kind === LayerKind.Node) {
      canvas?.select(pickLayers(canvas.selected, row.id, pickOf(e)));
      return;
    }
    video?.select(pickLayers(video.selection, row.id, pickOf(e)));
  }

  function run(ids: readonly string[], action: LayerAction, summary: string, name?: string) {
    if (!video) {
      return;
    }
    let doc = video.doc;
    for (const id of ids) {
      const result = layerEdit(doc, id, action, name);
      if (!result.ok) {
        video.edit(result, summary);
        return;
      }
      doc = result.doc;
    }
    video.edit({ ok: true, doc }, summary);
  }

  const SUMMARY: Record<LayerAction, string> = {
    [LayerAction.Up]: 'Brought a layer forward',
    [LayerAction.Down]: 'Sent a layer backward',
    [LayerAction.Hide]: 'Toggled a layer',
    [LayerAction.Lock]: 'Locked a layer',
    [LayerAction.Rename]: 'Renamed a track'
  };

  function onKey(e: KeyboardEvent) {
    const action = layerKey({ key: e.key, mod: e.metaKey || e.ctrlKey });
    const targets = picked.filter((id) => rows.some((r) => r.id === id && editable(r)));
    if (!action || !targets.length) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    run(action === LayerAction.Up ? targets : [...targets].reverse(), action, SUMMARY[action]);
  }

  function rename(row: LayerRow, name: string) {
    renaming = null;
    if (name.trim() && name !== row.label) {
      run([row.id], LayerAction.Rename, SUMMARY[LayerAction.Rename], name);
    }
  }

  function drop(row: LayerRow) {
    const from = dragged;
    const place = landing?.place;
    const moving = block;
    dragged = null;
    block = [];
    landing = null;
    if (!video || !from || !place || moving.includes(row.id)) {
      return;
    }
    video.edit(dropLayers(video.doc, moving, row.id, place, frameRows(video.doc, video.nodeId).map((r) => r.id)), moving.length > 1 ? `Moved ${moving.length} layers` : 'Moved a layer');
  }

  let menu = $state<{ x: number; y: number } | null>(null);

  function openMenu(row: LayerRow, e: MouseEvent) {
    if (!video || !editable(row)) {
      return;
    }
    e.preventDefault();
    if (!video.selection.includes(row.id)) {
      video.select([row.id]);
    }
    menu = { x: e.clientX, y: e.clientY };
  }

  function runMenu(item: (typeof LAYER_MENU)[number]) {
    menu = null;
    if (video) {
      video.edit(item.op(video.doc, video.selection), item.summary);
    }
  }
</script>

{#if canvas}
  {#each probing as head (headKey(head))}
    <PartsProbe url={`${canvas.previewUrl(head.nodeId)}?revision=${head.version}`} onmeasured={(boxes) => measured(head, boxes)} />
  {/each}
{/if}

<input class="search" type="search" placeholder="Search layers…" aria-label="Search layers" data-testid="layers-search" bind:value={query} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="layers" class:touch={density === Density.Touch} bind:this={list} role="tree" aria-label="Layers" aria-multiselectable="true" tabindex="0" data-testid="layers" data-key-region="editor" style:padding-top={`${span.start * rowStep}px`} style:padding-bottom={`${(shown.length - span.end) * rowStep}px`} onkeydown={onKey}>
  {#each visible as row (`${row.nodeId}/${row.key}`)}
    {@const RowIcon = KIND_ICON[row.kind] ?? ROW_ICON[row.type] ?? Square}
    <div
      class="row"
      class:picked={isPicked(row)}
      class:inside={inside.has(row.key)}
      class:muted={row.hidden}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isPicked(row)}
      tabindex="-1"
      data-layer={row.id}
      data-kind={row.kind}
      style={`padding-left: ${FOLD_GUTTER + row.depth * INDENT_PX}px`}
      draggable={editable(row)}
      class:hovered={layersSource.hovered?.id === row.id && layersSource.hovered?.nodeId === row.nodeId}
      onclick={(e) => choose(row, e)}
      onpointerenter={() => layersSource.hover({ nodeId: row.nodeId, id: row.id })}
      onpointerleave={() => layersSource.hover(null)}
      onkeydown={(e) => e.key === 'Enter' && choose(row, e as unknown as MouseEvent)}
      ondblclick={() => row.kind === LayerKind.Track && !row.nested && (renaming = row.id)}
      ondragstart={(e) => ((dragged = row.id), (block = isPicked(row) && picked.length > 1 ? [...picked] : [row.id]), e.dataTransfer?.setData('text/plain', row.id))}
      data-drop={landing?.key === row.key ? landing.place : undefined}
      ondragover={(e) => over(row, e)}
      ondragleave={() => landing?.key === row.key && (landing = null)}
      ondragend={() => ((dragged = null), (block = []), (landing = null))}
      ondrop={() => drop(row)}
      oncontextmenu={(e) => openMenu(row, e)}
    >
      {#if (row.kind === LayerKind.Node && frames.has(row.id)) || row.foldable}
        <button type="button" class="fold" aria-label={folds.has(row.key) ? 'Unfold' : 'Fold'} aria-expanded={!folds.has(row.key)} data-testid="layer-fold" onclick={(e) => (e.stopPropagation(), fold(row.key))}>
          {#if folds.has(row.key)}<ChevronRight size={ICON} />{:else}<ChevronDown size={ICON} />{/if}
        </button>
      {/if}
      {#if row.thumb}
        <img class="thumb" src={row.thumb} alt="" loading="lazy" decoding="async" data-testid="layer-thumb" />
      {/if}
      <span class="icon" style:--hue={ROW_HUE[row.type]}><RowIcon size={ICON} /></span>
      {#if renaming === row.id}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="name-input" value={row.label} autofocus aria-label="Track name" onblur={(e) => rename(row, e.currentTarget.value)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      {:else}
        <span class="name">{row.label}</span>
      {/if}
      {#if density === Density.Touch && editable(row) && isPicked(row)}
        <IconButton size={IconSize.Sm} label="Bring forward" onclick={(e) => (e.stopPropagation(), run([row.id], LayerAction.Up, SUMMARY[LayerAction.Up]))}><ChevronUp /></IconButton>
        <IconButton size={IconSize.Sm} label="Send backward" onclick={(e) => (e.stopPropagation(), run([row.id], LayerAction.Down, SUMMARY[LayerAction.Down]))}><ChevronDown /></IconButton>
      {/if}
      {#if editable(row)}
        <IconButton size={IconSize.Sm} label={eyeLabel(row)} pressed={row.hidden} onclick={(e) => (e.stopPropagation(), run([row.id], LayerAction.Hide, SUMMARY[LayerAction.Hide]))}>
          {#if row.hidden}<EyeOff />{:else}<Eye />{/if}
        </IconButton>
        <IconButton size={IconSize.Sm} label={row.locked ? 'Unlock' : 'Lock'} pressed={row.locked} disabled={row.kind === LayerKind.Group && row.type === PRECOMP} onclick={(e) => (e.stopPropagation(), run([row.id], LayerAction.Lock, SUMMARY[LayerAction.Lock]))}>
          {#if row.locked}<Lock />{:else}<LockOpen />{/if}
        </IconButton>
      {/if}
    </div>
  {:else}
    <p class="empty">{query.trim() ? 'No layer matches' : 'Nothing on this canvas yet'}</p>
  {/each}
</div>

<svelte:window onpointerdown={(e) => menu && !(e.target as HTMLElement).closest('[data-testid="layer-menu"]') && (menu = null)} onkeydown={(e) => e.key === 'Escape' && (menu = null)} />

{#if menu && video}
  <div class={MENU_CONTENT} role="menu" data-testid="layer-menu" style={`position: fixed; left: ${menu.x}px; top: ${menu.y}px`}>
    {#each LAYER_MENU as item (item.command)}
      {@const Icon = ACTIONS[item.command].icon}
      {@const allowed = item.op(video.doc, video.selection).ok}
      <button type="button" role="menuitem" class={MENU_ITEM} disabled={!allowed} data-disabled={allowed ? undefined : ''} onclick={() => runMenu(item)}>
        <Icon aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate">{ACTIONS[item.command].name}</span>
        {#if shortcutOf(item.command)}<Kbd shortcut={shortcutOf(item.command)} class="text-ui-text-3" />{/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .search {
    width: 100%;
    height: var(--ui-row);
    margin-bottom: 8px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-body);
    outline: none;
  }

  .search::placeholder {
    color: var(--ui-text-tertiary);
  }

  .search:hover {
    background: var(--ui-input-hover);
  }

  .search:focus-visible {
    box-shadow: var(--ui-ring);
  }

  .layers {
    display: flex;
    flex-direction: column;
    gap: 1px;
    outline: none;
    font-size: var(--ui-type-label);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ui-row);
    padding-right: 6px;
    border-radius: var(--ui-radius-md);
    color: var(--ui-text);
    cursor: default;
    user-select: none;
    transition: background-color var(--ui-dur-fast) var(--ui-ease);
  }

  .layers.touch {
    --ui-row: 44px;
  }

  .layers.touch :global(button) {
    min-width: 44px;
    min-height: 44px;
  }

  .layers.touch .fold {
    margin-left: -30px;
  }

  .row:hover {
    background: var(--ui-wash);
  }

  .row[data-drop='above'] {
    box-shadow: inset 0 2px 0 var(--ui-accent);
  }

  .row[data-drop='below'] {
    box-shadow: inset 0 -2px 0 var(--ui-accent);
  }

  .row[data-drop='into'] {
    box-shadow: inset 0 0 0 2px var(--ui-accent);
  }

  .row.hovered {
    box-shadow: inset 0 0 0 1px var(--ui-hover-outline);
  }

  .row.picked {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    font-weight: var(--ui-weight-medium);
  }

  .row.picked .icon,
  .row.picked .flag {
    color: var(--ui-on-accent);
  }

  .row.inside {
    background: var(--ui-selected);
    border-radius: 0;
  }

  .row.inside .icon {
    color: var(--ui-accent-text);
  }

  .row.muted .name {
    color: var(--ui-text-disabled);
  }

  .row[data-kind='track'] {
    font-weight: var(--ui-weight-medium);
  }

  .icon {
    display: grid;
    place-items: center;
    color: var(--hue, var(--ui-icon-ink));
  }

  .thumb {
    width: 20px;
    height: 20px;
    object-fit: cover;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-hover);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-input {
    flex: 1;
    min-width: 0;
    height: 22px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel);
    box-shadow: var(--ui-ring);
    color: var(--ui-text);
    font: inherit;
    outline: none;
  }

  .fold {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: -22px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-text-3);
  }

  .fold:hover {
    color: var(--ui-ink);
  }

  .empty {
    margin: 12px 8px;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }
</style>
