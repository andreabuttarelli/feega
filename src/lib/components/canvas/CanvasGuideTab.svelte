<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { DOCS_ORIGIN, GUIDES_INDEX_URL, filterGuides, guideUrl, parseGuides, type Guide } from '$lib/docs-guides';

  let {
    initialSlug = null,
    onopened
  }: {
    initialSlug?: string | null;
    onopened?: () => void;
  } = $props();

  let guides = $state<Guide[]>([]);
  let offline = $state(false);
  let query = $state('');
  let openPath = $state<string | null>(null);

  const shown = $derived(filterGuides(guides, query));
  const sections = $derived([...new Set(shown.map((guide) => guide.section))]);

  $effect(() => {
    fetch(GUIDES_INDEX_URL)
      .then((response) => response.json())
      .then((json) => (guides = parseGuides(json)))
      .catch(() => (offline = true));
  });

  $effect(() => {
    if (!initialSlug) {
      return;
    }
    openPath = initialSlug;
    onopened?.();
  });
</script>

{#if offline && guides.length === 0}
  <p class="guide-offline" data-testid="guide-offline">
    {$_('app.shell.guideOffline')}
    <a href={DOCS_ORIGIN} target="_blank" rel="noopener noreferrer">{DOCS_ORIGIN}</a>
  </p>
{:else if openPath}
  <div class="guide-open">
    <div class="guide-bar">
      <button type="button" class="guide-back" onclick={() => (openPath = null)}>
        ← {$_('app.shell.guideBack')}
      </button>
      <a href={guideUrl(openPath)} target="_blank" rel="noopener noreferrer">{$_('app.shell.guideNewTab')}</a>
    </div>
    <iframe class="guide-frame" title="docs" src={guideUrl(openPath)} data-testid="guide-frame"></iframe>
  </div>
{:else}
  <input class="guide-search" type="search" placeholder={$_('app.shell.guideSearch')} bind:value={query} data-testid="guide-search" />
  {#each sections as section (section)}
    <h3 class="guide-section">{section}</h3>
    <ul class="guide-list">
      {#each shown.filter((guide) => guide.section === section) as guide (guide.path)}
        <li>
          <button type="button" class="guide-item" onclick={() => (openPath = guide.path)}>
            {guide.title}
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    {#if guides.length > 0}
      <p class="guide-offline">{$_('app.shell.guideEmpty')}</p>
    {/if}
  {/each}
{/if}

<style>
  .guide-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .guide-section {
    margin: 12px 0 4px;
    font-size: 11px;
    text-transform: capitalize;
    color: var(--ui-text-3);
  }

  .guide-search {
    width: 100%;
    padding: 6px 8px;
    font: inherit;
    font-size: 12.5px;
  }

  .guide-item {
    width: 100%;
    text-align: left;
    padding: 10px 8px;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }

  .guide-item:hover {
    background: color-mix(in srgb, var(--ui-text) 5%, transparent);
  }

  .guide-open {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
  }

  .guide-bar {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .guide-bar a {
    color: var(--ui-accent-text);
  }

  .guide-back {
    border: 0;
    background: transparent;
    color: var(--ui-accent-text);
    font: inherit;
    cursor: pointer;
    padding: 4px 0;
  }

  .guide-frame {
    flex: 1;
    width: 100%;
    border: 0;
    min-height: 0;
  }

  .guide-offline {
    font-size: 12.5px;
    line-height: 1.5;
  }
</style>
