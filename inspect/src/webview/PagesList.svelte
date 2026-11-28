<script lang="ts">
  import ActionBanner from './ActionBanner.svelte';
  import ExampleField from './ExampleField.svelte';
  import { freshKeys } from './fresh-keys.svelte';
  import { EXAMPLE_LIMIT, type PageRow } from './pages';

  type Props = { rows: PageRow[]; onopen: (route: string) => void; onadd: (pattern: string, path: string) => void; oncanvas?: () => void };

  let { rows, onopen, onadd, oncanvas }: Props = $props();

  let expanded = $state<string[]>([]);

  const fresh = freshKeys(() => rows.map((row) => row.route));

  const shownOf = (row: PageRow) => (expanded.includes(row.route) ? row.examples : row.examples.slice(0, EXAMPLE_LIMIT));
  const hiddenOf = (row: PageRow) => row.examples.length - shownOf(row).length;
  const expand = (route: string) => (expanded = [...expanded, route]);
</script>

{#if oncanvas}<ActionBanner testid="canvas-open-pages" onopen={oncanvas} />{/if}

<ul class="pages" data-testid="pages">
  {#each rows as row (row.route)}
    {#if row.dynamic}
      <li class="group" data-testid="page-group" data-route={row.route}>
        <span class="page head"><span class="route">{row.route}</span></span>
        <ul class="examples">
          {#each shownOf(row) as example (example.path)}
            <li>
              <button type="button" class="page example" class:on={example.current} aria-current={example.current ? 'page' : undefined} title={`Open ${example.path}`} data-testid="page-example" data-path={example.path} onclick={() => onopen(example.path)}>
                <span class="route">{example.label}</span>
              </button>
            </li>
          {/each}
          {#if hiddenOf(row) > 0}
            <li><button type="button" class="page more" data-testid="page-more" onclick={() => expand(row.route)}>{hiddenOf(row)} more</button></li>
          {/if}
          {#if row.examples.length === 0}
            <li class="manual"><ExampleField pattern={row.route} onadd={(path) => onadd(row.route, path)} /></li>
          {/if}
        </ul>
      </li>
    {:else}
      <li>
        <button type="button" class="page" class:on={row.current} class:fresh={fresh.has(row.route)} aria-current={row.current ? 'page' : undefined} title={`Open ${row.route}`} data-testid="page-row" data-route={row.route} onclick={() => onopen(row.route)}>
          <span class="route">{row.route}</span>
        </button>
      </li>
    {/if}
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

  .head {
    cursor: default;
  }

  .examples {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .example,
  .more {
    padding-left: 24px;
  }

  .more {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .manual {
    padding: 2px 12px 4px 24px;
  }

  button.page:hover {
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

  .page.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .route {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 8px 12px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }
</style>
