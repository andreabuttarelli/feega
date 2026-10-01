<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import {
    ALL_TEMPLATES,
    CANVAS_TEMPLATES,
    TEMPLATE_CATEGORIES,
    templateNodeTypes,
    templatesIn,
    templateThumbnail,
    type TemplateFilter
  } from '$lib/canvas/templates';
  import { NODE_KIND_ICON, NODE_KIND_LABEL } from '$lib/canvas/node-label';

  let { open = $bindable(false), onpick }: { open?: boolean; onpick: (id: string) => void } = $props();

  const FILTERS: { id: TemplateFilter; label: string }[] = [{ id: ALL_TEMPLATES, label: 'All' }, ...TEMPLATE_CATEGORIES];

  const GRID_STEP: Record<string, (columns: number) => number> = {
    ArrowRight: () => 1,
    ArrowLeft: () => -1,
    ArrowDown: (columns) => columns,
    ArrowUp: (columns) => -columns
  };

  let filter = $state<TemplateFilter>(ALL_TEMPLATES);
  let grid = $state<HTMLDivElement | null>(null);

  const shown = $derived(templatesIn(filter));

  function countOf(id: TemplateFilter): number {
    return templatesIn(id).length;
  }

  function cards(): HTMLButtonElement[] {
    return [...(grid?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
  }

  function columnsOf(items: HTMLButtonElement[]): number {
    const firstTop = items[0]?.offsetTop;
    const columns = items.filter((item) => item.offsetTop === firstTop).length;
    return Math.max(columns, 1);
  }

  function focusFirst(e: Event) {
    e.preventDefault();
    cards()[0]?.focus();
  }

  function moveFocus(e: KeyboardEvent) {
    const items = cards();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) {
      return;
    }

    const target = targetIndex(e.key, current, items);
    if (target === null) {
      return;
    }

    e.preventDefault();
    items[target]?.focus();
  }

  function targetIndex(key: string, current: number, items: HTMLButtonElement[]): number | null {
    if (key === 'Home') {
      return 0;
    }
    if (key === 'End') {
      return items.length - 1;
    }

    const step = GRID_STEP[key];
    if (!step) {
      return null;
    }

    const next = current + step(columnsOf(items));
    return Math.min(Math.max(next, 0), items.length - 1);
  }

  function pick(id: string) {
    open = false;
    onpick(id);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="template-sheet" onOpenAutoFocus={focusFirst}>
    <header class="head">
      <Dialog.Title class="title">Templates</Dialog.Title>
      <Dialog.Description class="lede">
        Start from a ready-made flow. Every node lands on the canvas, connected and editable.
      </Dialog.Description>
    </header>

    <div class="filters" role="tablist" aria-label="Template categories">
      {#each FILTERS as option (option.id)}
        <button
          type="button"
          role="tab"
          class="filter"
          aria-selected={filter === option.id}
          onclick={() => (filter = option.id)}
        >
          {option.label}
          <span class="count">{countOf(option.id)}</span>
        </button>
      {/each}
    </div>

    <div class="scroll">
      <div class="grid" role="menu" aria-label="Templates" tabindex="-1" bind:this={grid} onkeydown={moveFocus}>
        {#each shown as template (template.id)}
          <button type="button" class="card" role="menuitem" onclick={() => pick(template.id)}>
            <span class="name">{template.name}</span>
            <span class="thumb">
              <img src={templateThumbnail(template)} alt="" loading="lazy" decoding="async" width="600" height="400" />
            </span>
            <span class="description">{template.description}</span>
            <span class="chips">
              {#each templateNodeTypes(template) as type (type)}
                {@const Icon = NODE_KIND_ICON[type]}
                <span class="chip"><Icon size={12} strokeWidth={1.8} aria-hidden="true" />{NODE_KIND_LABEL[type]}</span>
              {/each}
              <span class="chip nodes">{template.nodes.length} nodes</span>
            </span>
          </button>
        {/each}
      </div>
    </div>

    <footer class="foot">
      <span>{CANVAS_TEMPLATES.length} templates</span>
      <span class="keys"><kbd>←</kbd><kbd>→</kbd> move · <kbd>Enter</kbd> insert · <kbd>Esc</kbd> close</span>
    </footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  @layer utilities {
    :global([data-slot='dialog-content'].template-sheet) {
      display: flex !important;
      flex-direction: column !important;
      gap: 0 !important;
      width: min(1080px, calc(100vw - 48px)) !important;
      max-width: none !important;
      height: min(780px, calc(100dvh - 48px)) !important;
      padding: 0 !important;
      color: var(--ink) !important;
      background: var(--paper) !important;
      border: 1px solid var(--line-2) !important;
      border-radius: 0 !important;
      box-shadow: 0 24px 64px rgb(0 0 0 / 0.16) !important;
    }

    @media (max-width: 767px) {
      :global([data-slot='dialog-content'].template-sheet) {
        inset: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        border: 0 !important;
        translate: none !important;
        box-shadow: none !important;
      }
    }
  }

  .head {
    display: grid;
    gap: 4px;
    padding: 24px 56px 16px 24px;
  }
  .head :global(.title) {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .head :global(.lede) {
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft);
  }

  .filters {
    display: flex;
    gap: 6px;
    padding: 0 24px 16px;
    overflow-x: auto;
    border-bottom: 1px solid var(--line);
  }
  .filter {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: none;
    padding: 7px 12px;
    font: inherit;
    font-size: 13px;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--line-2);
    border-radius: 0;
    cursor: pointer;
  }
  .filter:hover {
    background: var(--paper-2);
  }
  .filter[aria-selected='true'] {
    color: var(--paper);
    background: var(--invert-surface);
    border-color: var(--invert-surface);
  }
  .filter:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .count {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 24px 24px;
    background: var(--paper-3);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
    gap: 16px;
    outline: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 0 14px;
    text-align: left;
    font: inherit;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--line-2);
    border-radius: 0;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  .card:hover {
    border-color: var(--ink-faint);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
  }
  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .name {
    order: 1;
    padding: 0 14px;
    font-size: 14px;
    font-weight: 600;
  }
  .thumb {
    order: 0;
    display: block;
    aspect-ratio: 3 / 2;
    overflow: hidden;
    background: var(--paper-2);
    border-bottom: 1px solid var(--line);
  }
  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 240ms ease;
  }
  .card:hover .thumb img {
    transform: scale(1.03);
  }
  .description {
    order: 2;
    padding: 0 14px;
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
  .chips {
    order: 3;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: auto;
    padding: 0 14px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    font-size: 11px;
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line);
  }
  .chip.nodes {
    color: var(--ink-faint);
    background: none;
    border-color: transparent;
  }

  .foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 24px;
    font-size: 11.5px;
    color: var(--ink-faint);
    border-top: 1px solid var(--line);
  }
  kbd {
    display: inline-block;
    min-width: 18px;
    margin-right: 2px;
    padding: 0 4px;
    font: inherit;
    text-align: center;
    color: var(--ink-soft);
    border: 1px solid var(--line-2);
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .thumb img {
      transition: none;
    }
  }

  @media (max-width: 767px) {
    .head {
      padding: 16px 56px 12px var(--page-gutter);
    }
    .filters {
      padding: 0 var(--page-gutter) 12px;
    }
    .scroll {
      padding: 12px var(--page-gutter) calc(16px + env(safe-area-inset-bottom, 0px));
    }
    .grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .keys {
      display: none;
    }
    .foot {
      display: none;
    }
  }
</style>
