<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { FLOAT_GLYPH, FLOAT_HINT, ICON_SVG, floatingOf, iconOf } from './layer-icons';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import Unlock from '@lucide/svelte/icons/lock-open';
  import { AddKind, AddPlace } from '@feega/live-edit/add-node';
  import { Place } from '@feega/live-edit/move-node';
  import type { LayerNode, Pick, Source } from '../messages';
  import { ADD_DRAG_TYPE, rowPlace } from './insert-drop';
  import { sourceText } from './page-bridge';
  import { actionsOf, roleOf } from './roles';
  import { hiddenHere } from './layer-state';
  import { Shortcut, isMac, shortcutOf } from './selection-keys';
  import Self from './LayersTree.svelte';

  type Props = {
    nodes: LayerNode[];
    picked: Pick | null;
    selected: Set<string>;
    badge?: string;
    depth?: number;
    open: Record<string, boolean>;
    onselect: (source: Source, instance: number, e?: MouseEvent) => void;
    onhover: (source: Source | null, instance: number) => void;
    onopen: (source: Source) => void;
    onmove: (from: Source, to: Source, place: Place) => void;
    dragging: { source: Source | null; name: string; component: boolean; parentFile: string | null; hint: { id: string; place: AddPlace } | null };
    oncontext: (source: Source, instance: number, at: { x: number; y: number }) => void;
    onadd: (kind: AddKind, source: Source, place: AddPlace) => void;
    parentFile?: string | null;
    onusage: (file: string, from: string, to: string, place: Place) => void;
    hidden: Set<string>;
    locked: Set<string>;
    ontoggle: (flag: 'hidden' | 'locked', source: Source) => void;
    onfocus: (node: LayerNode) => void;
    ondelete: (source: Source, instance: number) => void;
  };

  let { nodes, picked, selected, badge = '', depth = 0, open, onselect, onhover, onopen, onmove, dragging, parentFile = null, onusage, hidden, locked, ontoggle, oncontext, onadd, onfocus, ondelete }: Props = $props();

  const INDENT_PX = 12;
  const EDGE_BAND = 0.25;
  const key = (n: LayerNode) => (n.source ? sourceText(n.source) : `group:${n.name}`);
  const isPicked = (n: LayerNode) => picked !== null && n.source !== null && sourceText(picked.source) === sourceText(n.source);
  const actions = (n: LayerNode) => actionsOf(roleOf({ tag: n.tag, ownText: false, inlineText: false, elements: n.children.length, display: n.display }));
  const visual = (n: LayerNode) => n.source !== null && actions(n).visibility;
  const choose = (n: LayerNode, e?: MouseEvent) => (n.source ? onselect(n.source, n.instance, e) : (open[key(n)] = !open[key(n)]));

  function onKey(e: KeyboardEvent, node: LayerNode) {
    if (node.source && shortcutOf(e, isMac) === Shortcut.Delete) {
      e.preventDefault();
      e.stopPropagation();
      ondelete(node.source, node.instance);
      return;
    }
    const actions: Record<string, () => void> = {
      Enter: () => (node.source ? onopen(node.source) : choose(node)),
      ' ': () => choose(node),
      ArrowRight: () => (open[key(node)] = true),
      ArrowLeft: () => (open[key(node)] = false)
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  }

  const addDrag = (e: DragEvent) => e.dataTransfer?.types.includes(ADD_DRAG_TYPE) ?? false;

  const placeOf = (e: DragEvent) => {
    const { top, height } = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return rowPlace((e.clientY - top) / height);
  };

  function onOver(e: DragEvent, node: LayerNode) {
    e.preventDefault();
    if (addDrag(e) && node.source) {
      dragging.hint = { id: key(node), place: placeOf(e) };
    }
  }

  function onContext(e: MouseEvent, node: LayerNode) {
    if (!node.source) {
      return;
    }
    e.preventDefault();
    oncontext(node.source, node.instance, { x: e.clientX, y: e.clientY });
  }

  function onDrop(e: DragEvent, node: LayerNode) {
    e.preventDefault();
    dragging.hint = null;
    if (addDrag(e)) {
      const kind = e.dataTransfer?.getData(ADD_DRAG_TYPE) as AddKind;
      if (node.source && kind) {
        onadd(kind, node.source, placeOf(e));
      }
      return;
    }
    const from = dragging.source;
    dragging.source = null;
    if (!from || !node.source) {
      return;
    }
    const row = e.currentTarget as HTMLElement;
    const { top, height } = row.getBoundingClientRect();
    const ratio = (e.clientY - top) / height;
    if (node.component && dragging.component && dragging.name !== node.name && parentFile && parentFile === dragging.parentFile) {
      onusage(parentFile, dragging.name, node.name, ratio < 0.5 ? Place.Before : Place.After);
      return;
    }
    onmove(from, node.source, ratio < EDGE_BAND ? Place.Before : ratio > 1 - EDGE_BAND ? Place.After : Place.Inside);
  }
</script>

{#each nodes as node (key(node))}
  {@const id = key(node)}
  <div
    class="row"
    class:picked={selected.has(id)}
    class:dim={hidden.has(id)}
    class:drop-before={dragging.hint?.id === id && dragging.hint.place === AddPlace.Before}
    class:drop-after={dragging.hint?.id === id && dragging.hint.place === AddPlace.After}
    class:drop-child={dragging.hint?.id === id && dragging.hint.place === AddPlace.Child}
    role="treeitem"
    aria-selected={selected.has(id)}
    aria-expanded={node.children.length ? Boolean(open[id]) : undefined}
    tabindex="0"
    draggable={visual(node)}
    style={`padding-left:${8 + depth * INDENT_PX}px`}
    data-layer={id}
    onclick={(e) => choose(node, e)}
    ondblclick={() => node.component && onfocus(node)}
    onkeydown={(e) => onKey(e, node)}
    onpointerenter={() => onhover(visual(node) ? node.source : null, node.instance)}
    onpointerleave={() => onhover(null, 0)}
    ondragstart={() => Object.assign(dragging, { source: node.source, name: node.name, component: node.component, parentFile })}
    ondragover={(e) => onOver(e, node)}
    ondragleave={() => dragging.hint?.id === id && (dragging.hint = null)}
    oncontextmenu={(e) => onContext(e, node)}
    ondrop={(e) => onDrop(e, node)}
  >
    {#if node.children.length}
      <button type="button" class="twist" class:open={open[id]} aria-label={open[id] ? 'Collapse' : 'Expand'} onclick={(e) => (e.stopPropagation(), (open[id] = !open[id]))}><ChevronRight size={12} /></button>
    {:else}
      <span class="twist"></span>
    {/if}
    <svg class="type" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="0.833" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICON_SVG[iconOf(node)]}</svg>
    <span class="name" class:component={node.component}>{node.name}</span>{#if badge && isPicked(node)}<span class="state-badge" data-testid="layer-state-badge">{badge}</span>{/if}
    {#if hiddenHere(node)}<span class="hidden-here" title="Hidden at this size" aria-label="Hidden at this size" data-hidden-here><EyeOff size={11} /></span>{/if}
    {#if floatingOf(node.position)}<span class={`float ${floatingOf(node.position)}`} data-float={floatingOf(node.position)} title={FLOAT_HINT[floatingOf(node.position)!]} aria-label={FLOAT_HINT[floatingOf(node.position)!]}><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">{@html FLOAT_GLYPH[floatingOf(node.position)!]}</svg></span>{/if}
    {#if node.count > 1 && node.source}<span class="count" title={`Rendered ${node.count} times by a loop in ${node.source.file}:${node.source.line} — edits apply to all ${node.count}`}>×{node.count}</span>{:else if !node.source}<span class="count">{node.count}</span>{/if}
    {#if actions(node).visibility && node.source}<span class="toggles" class:active={hidden.has(id) || locked.has(id)}>
      <button type="button" class="t" title={hidden.has(id) ? 'Show (⇧⌘H)' : 'Hide: display none in code (⇧⌘H)'} aria-label={hidden.has(id) ? 'Show' : 'Hide'} onclick={(e) => (e.stopPropagation(), ontoggle('hidden', node.source!))}>{#if hidden.has(id)}<EyeOff size={12} />{:else}<Eye size={12} />{/if}</button>
      <button type="button" class="t" title={locked.has(id) ? 'Unlock (⇧⌘L)' : 'Lock (⇧⌘L)'} aria-label={locked.has(id) ? 'Unlock' : 'Lock'} onclick={(e) => (e.stopPropagation(), ontoggle('locked', node.source!))}>{#if locked.has(id)}<Lock size={12} />{:else}<Unlock size={12} />{/if}</button>
    </span>{/if}
  </div>
  {#if node.children.length && open[id]}
    <Self nodes={node.children} {picked} {selected} {badge} depth={depth + 1} {open} {onselect} {onhover} {onopen} {onmove} {dragging} parentFile={node.source?.file ?? null} {onusage} {hidden} {locked} {ontoggle} {oncontext} {onadd} {onfocus} {ondelete} />
  {/if}
{/each}

<style>
  .hidden-here {
    display: grid;
    place-items: center;
    color: var(--ui-text-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding-right: 8px;
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
    cursor: default;
    outline: none;
    user-select: none;
  }

  .row:hover {
    background: var(--ui-input);
  }

  .row:focus-visible {
    box-shadow: inset 0 0 0 1px var(--ui-accent);
  }

  .row.drop-before {
    box-shadow: inset 0 2px 0 var(--ui-accent);
  }

  .row.drop-after {
    box-shadow: inset 0 -2px 0 var(--ui-accent);
  }

  .row.drop-child {
    box-shadow: inset 0 0 0 1px var(--ui-accent);
    background: color-mix(in srgb, var(--ui-accent) 14%, transparent);
  }

  .row.picked {
    background: color-mix(in srgb, var(--ui-accent) 22%, transparent);
  }

  .twist {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text-3);
    cursor: pointer;
    transition: transform 120ms ease;
  }

  .twist.open {
    transform: rotate(90deg);
  }

  .type {
    flex: none;
    color: var(--ui-text-3);
  }

  .state-badge {
    flex: none;
    padding: 0 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: 10px;
    line-height: 14px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name.component {
    color: #a78bfa;
  }

  .toggles {
    display: none;
    gap: 2px;
    margin-left: auto;
  }

  .row:hover .toggles,
  .toggles.active {
    display: flex;
  }

  .t {
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 3px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .t:hover {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  .row.dim .name {
    opacity: 0.45;
  }

  .float {
    display: inline-flex;
    flex: none;
    color: var(--ui-accent);
  }

  .float svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.2;
  }

  .float.sticky {
    color: var(--ui-text-3);
  }

  .count {
    margin-left: auto;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }
</style>
