<script lang="ts">
  import CanvasBanner from './CanvasBanner.svelte';
  import { freshKeys } from './fresh-keys.svelte';
  import type { PageRow } from './pages';

  type Props = { rows: PageRow[]; onopen: (route: string) => void; oncanvas: () => void };

  let { rows, onopen, oncanvas }: Props = $props();

  const fresh = freshKeys(() => rows.map((row) => row.route));
</script>

<CanvasBanner hint="See every page at every size" testid="canvas-open-pages" onopen={oncanvas} />

<ul class="pages" data-testid="pages">
  {#each rows as row (row.route)}
    <li>
      <button type="button" class="page" class:on={row.current} class:fresh={fresh.has(row.route)} aria-current={row.current ? 'page' : undefined} disabled={row.dynamic} title={row.dynamic ? 'Dynamic route: open it from a link in the preview' : `Open ${row.route}`} data-testid="page-row" data-route={row.route} onclick={() => onopen(row.route)}>
        <span class="route">{row.route}</span>
        {#if row.dynamic}<span class="tag" data-testid="page-dynamic">dynamic</span>{/if}
      </button>
    </li>
  {:else}
    <li class="empty" data-testid="pages-empty">No pages found yet. Pages you visit in the preview appear here.</li>
  {/each}
</ul>

<style>
  .pages {
    margin: 0;
    padding: 4px 0;
    list-style: none;
  }

  .page {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: 100%;
    height: 26px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
    cursor: pointer;
  }

  .page:hover:not(:disabled) {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .page.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .page.fresh {
    animation: flash 2.5s ease-out;
  }

  @keyframes flash {
    from {
      background: color-mix(in srgb, var(--ui-accent) 35%, transparent);
    }
  }

  .page:disabled {
    cursor: default;
  }

  .route {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag {
    margin-left: auto;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-size: var(--ui-text-xs);
  }

  .empty {
    padding: 8px 12px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }
</style>
