<script lang="ts">
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import Square from '@lucide/svelte/icons/square';
  import { layersSource } from '$lib/canvas/layers-source.svelte';
  import { PART_SEP } from '$lib/motion/poster-parts';
  import { LayerAction, LayerKind, Pick, dropLayer, layerEdit, layerKey, layerRows, pickLayers, type LayerRow } from '$lib/canvas/layers';

  const ICON = 14;
  const INDENT_PX = 14;

  const canvas = $derived(layersSource.canvas);
  const video = $derived(layersSource.video);
  const rows = $derived(layerRows(canvas?.nodes ?? [], video ? { nodeId: video.nodeId, doc: video.doc, parts: video.parts } : null));
  const order = $derived(rows.map((r) => r.id));

  let picked = $state<string[]>([]);
  let renaming = $state<string | null>(null);
  let dragged = $state<string | null>(null);

  const isPicked = (row: LayerRow) => (row.kind === LayerKind.Part ? video?.part === row.id : picked.includes(row.id) || (row.kind === LayerKind.Node ? canvas?.selected.includes(row.id) : video?.selection.includes(row.id)));
  const editable = (row: LayerRow) => row.kind !== LayerKind.Node && !row.nested;

  const pickOf = (e: MouseEvent | KeyboardEvent): Pick => (e.shiftKey ? Pick.Range : e.metaKey || e.ctrlKey ? Pick.Toggle : Pick.One);

  function choose(row: LayerRow, e: MouseEvent) {
    if (row.kind === LayerKind.Part) {
      const at = row.id.indexOf(PART_SEP);
      video?.selectPart(row.id.slice(0, at), row.id.slice(at + 1));
      return;
    }
    picked = pickLayers(picked, row.id, pickOf(e), order);
    if (row.kind === LayerKind.Node) {
      canvas?.select(picked.filter((id) => rows.some((r) => r.id === id && r.kind === LayerKind.Node)));
      return;
    }
    video?.select(picked.filter((id) => rows.some((r) => r.id === id && (r.kind === LayerKind.Clip || r.kind === LayerKind.Group))));
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
      onclick={(e) => choose(row, e)}
      onkeydown={(e) => e.key === 'Enter' && choose(row, e as unknown as MouseEvent)}
      ondblclick={() => row.kind === LayerKind.Track && !row.nested && (renaming = row.id)}
      ondragstart={() => (dragged = row.id)}
      ondragover={(e) => row.kind === LayerKind.Track && e.preventDefault()}
      ondrop={() => drop(row)}
    >
      <span class="icon">{#if row.type === 'motion'}<Clapperboard size={ICON} />{:else}<Square size={ICON} />{/if}</span>
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
    outline: none;
    font-size: var(--ui-text-sm);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding-right: 4px;
    color: var(--ui-ink);
    cursor: default;
    user-select: none;
  }

  .row:hover {
    background: var(--ui-hover);
  }

  .row.picked {
    background: color-mix(in srgb, var(--ui-accent) 12%, transparent);
    color: var(--ui-accent);
  }

  .row.muted .name {
    opacity: 0.45;
  }

  .row[data-kind='track'] {
    font-weight: 600;
  }

  .icon {
    display: grid;
    place-items: center;
    color: var(--ui-text-3);
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
    border-radius: 0;
    font: inherit;
  }

  .flag {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-text-3);
  }

  .flag:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .empty {
    margin: 12px 8px;
    color: var(--ui-text-3);
  }
</style>
