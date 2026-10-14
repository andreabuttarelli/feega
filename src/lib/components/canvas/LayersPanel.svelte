<script lang="ts">
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import Square from '@lucide/svelte/icons/square';
  import ImageIcon from '@lucide/svelte/icons/image';
  import TypeIcon from '@lucide/svelte/icons/type';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { layersSource } from '$lib/canvas/layers-source.svelte';
  import { untrack } from 'svelte';
  import { PART_SEP } from '$lib/motion/poster-parts';
  import { HEADS_PARAM, cacheOutlines, canvasHeads, headsParam, missingHeads, outlinesFor, type OutlineCache } from '$lib/canvas/frame-outlines';
  import { LayerAction, LayerKind, Pick, dropLayer, layerEdit, layerKey, layerRows, pickFor, pickLayers, rowPicked, selectedLayers, type LayerRow } from '$lib/canvas/layers';

  const ICON = 14;
  const INDENT_PX = 14;

  const canvas = $derived(layersSource.canvas);
  const video = $derived(layersSource.video);
  const heads = $derived(canvasHeads(canvas?.nodes ?? []));
  let outlines = $state.raw<OutlineCache>({});
  let opening = $state<{ nodeId: string; id: string } | null>(null);

  const rows = $derived(layerRows(canvas?.nodes ?? [], video ? { nodeId: video.nodeId, doc: video.doc, parts: video.parts } : null, outlinesFor(heads, outlines)));

  $effect(() => {
    const url = canvas?.outlinesUrl;
    const missing = missingHeads(heads, untrack(() => outlines));
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

  let renaming = $state<string | null>(null);
  let dragged = $state<string | null>(null);

  const ROW_ICON: Record<string, typeof Square> = { motion: Clapperboard, image: ImageIcon, text: TypeIcon, arrow: ArrowRight };
  const isPicked = (row: LayerRow) => rowPicked(row, selection);
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
    dragged = null;
    if (!video || !from || from === row.id) {
      return;
    }
    video.edit(dropLayer(video.doc, from, row.id), 'Moved a layer');
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="layers" role="tree" aria-label="Layers" aria-multiselectable="true" tabindex="0" data-testid="layers" data-key-region="editor" onkeydown={onKey}>
  {#each rows as row (row.nodeId + row.id)}
    {@const RowIcon = ROW_ICON[row.type] ?? Square}
    <div
      class="row"
      class:picked={isPicked(row)}
      class:muted={row.hidden}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isPicked(row)}
      tabindex="-1"
      data-layer={row.id}
      data-kind={row.kind}
      style={`padding-left: ${8 + row.depth * INDENT_PX}px`}
      draggable={editable(row)}
      class:hovered={layersSource.hovered?.id === row.id && layersSource.hovered?.nodeId === row.nodeId}
      onclick={(e) => choose(row, e)}
      onpointerenter={() => layersSource.hover({ nodeId: row.nodeId, id: row.id })}
      onpointerleave={() => layersSource.hover(null)}
      onkeydown={(e) => e.key === 'Enter' && choose(row, e as unknown as MouseEvent)}
      ondblclick={() => row.kind === LayerKind.Track && !row.nested && (renaming = row.id)}
      ondragstart={() => (dragged = row.id)}
      ondragover={(e) => row.kind === LayerKind.Track && e.preventDefault()}
      ondrop={() => drop(row)}
    >
      <span class="icon"><RowIcon size={ICON} /></span>
      {#if renaming === row.id}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="name-input" value={row.label} autofocus aria-label="Track name" onblur={(e) => rename(row, e.currentTarget.value)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      {:else}
        <span class="name">{row.label}</span>
      {/if}
      {#if editable(row)}
        <button type="button" class="flag" aria-label={row.hidden ? 'Show' : 'Hide'} aria-pressed={row.hidden} onclick={(e) => (e.stopPropagation(), run([row.id], LayerAction.Hide, SUMMARY[LayerAction.Hide]))}>
          {#if row.hidden}<EyeOff size={ICON} />{:else}<Eye size={ICON} />{/if}
        </button>
        <button type="button" class="flag" aria-label={row.locked ? 'Unlock' : 'Lock'} aria-pressed={row.locked} disabled={row.kind === LayerKind.Group} onclick={(e) => (e.stopPropagation(), run([row.id], LayerAction.Lock, SUMMARY[LayerAction.Lock]))}>
          {#if row.locked}<Lock size={ICON} />{:else}<LockOpen size={ICON} />{/if}
        </button>
      {/if}
    </div>
  {:else}
    <p class="empty">Nothing on this canvas yet</p>
  {/each}
</div>

<style>
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
    padding-right: 4px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
    cursor: default;
    user-select: none;
    transition: background-color var(--ui-dur-fast) var(--ui-ease);
  }

  .row:hover {
    background: var(--ui-wash);
  }

  .row.hovered {
    box-shadow: inset 0 0 0 1px var(--ui-hover-outline);
  }

  .row.picked {
    background: var(--ui-selected);
    color: var(--ui-accent-text);
  }

  .row.picked .icon {
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
    color: var(--ui-icon-ink);
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

  .flag {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-tertiary);
    opacity: 0;
    transition: opacity var(--ui-dur-fast) var(--ui-ease);
  }

  .row:hover .flag,
  .row:focus-within .flag,
  .flag[aria-pressed='true'] {
    opacity: 1;
  }

  .flag:hover {
    background: var(--ui-pressed);
    color: var(--ui-text);
  }

  .flag:focus-visible {
    opacity: 1;
    outline: none;
    box-shadow: var(--ui-ring);
  }

  @media (pointer: coarse) {
    .flag {
      opacity: 1;
    }
  }

  .empty {
    margin: 12px 8px;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }
</style>
