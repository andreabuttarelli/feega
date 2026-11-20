<script lang="ts">
  import { Popover } from 'bits-ui';
  import { IconSource, ToHost, type Pick } from '../messages';
  import { toHost } from './host';
  import { iconSearch } from './icon-search.svelte';
  import { sourceText } from './page-bridge';

  const SEARCH_DELAY_MS = 200;
  const ICON_SIZE = 24;
  const ICON_STROKE = 2;

  let { pick }: { pick: Pick } = $props();

  let query = $state('');
  let code = $state('');
  let requested = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let upload: HTMLInputElement;

  const at = $derived(sourceText(pick.source));
  const library = $derived(iconSearch.hits.filter((h) => h.source === IconSource.Library));
  const remote = $derived(iconSearch.hits.filter((h) => h.source === IconSource.IconMcp));

  function search(text: string) {
    query = text;
    clearTimeout(timer);
    timer = setTimeout(() => toHost({ kind: ToHost.IconSearch, id: ++requested, query: text }), SEARCH_DELAY_MS);
  }

  const useLibrary = (name: string) => toHost({ kind: ToHost.IconSwap, at, name });
  const useRemote = (name: string) => toHost({ kind: ToHost.IconGet, at, name, size: ICON_SIZE, stroke: ICON_STROKE, inner: pick.inner });
  const apply = () => toHost({ kind: ToHost.IconMarkup, at, markup: code, inner: pick.inner });

  async function uploaded(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      toHost({ kind: ToHost.IconMarkup, at, markup: (await file.text()).trim(), inner: pick.inner });
    }
  }
</script>

<div class="actions" data-testid="icon-actions">
  <Popover.Root onOpenChange={(open) => open && search(query)}>
    <Popover.Trigger class="action" data-field="icon-replace">Replace icon…</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content class="picker-popover icon-popover" side="left" sideOffset={8} collisionPadding={8}>
        <input type="search" class="icon-query" placeholder="Search icons" aria-label="Search icons" value={query} oninput={(e) => search(e.currentTarget.value)} />
        <div class="icon-results">
          {#if library.length}
            <div class="group-label">{iconSearch.library}</div>
            {#each library as hit (hit.name)}
              <button type="button" class="icon-hit" onclick={() => useLibrary(hit.name)}>{hit.name}</button>
            {/each}
          {/if}
          {#if remote.length}
            <div class="group-label">iconmcp.com</div>
            {#each remote as hit (hit.name)}
              <button type="button" class="icon-hit" onclick={() => useRemote(hit.name)}>{hit.label ?? hit.name}</button>
            {/each}
          {/if}
          {#if iconSearch.error}<div class="icon-note">iconmcp.com: {iconSearch.error}</div>{/if}
          {#if !iconSearch.hits.length && !iconSearch.error}<div class="icon-note">No icons found</div>{/if}
        </div>
        <button type="button" class="action" onclick={() => upload.click()}>Upload .svg…</button>
        <input bind:this={upload} type="file" accept=".svg,image/svg+xml" hidden onchange={uploaded} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>

  <Popover.Root onOpenChange={(open) => open && (code = pick.markup ?? '')}>
    <Popover.Trigger class="action" data-field="icon-edit-svg">Edit SVG</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content class="picker-popover icon-popover" side="left" sideOffset={8} collisionPadding={8}>
        <textarea class="icon-code" aria-label="SVG markup" spellcheck="false" bind:value={code}></textarea>
        <button type="button" class="action" onclick={apply}>Apply</button>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
</div>

<style>
  .actions {
    display: flex;
    gap: 4px;
    padding: 4px 8px 0;
  }

  .actions :global(.action),
  :global(.icon-popover) :global(.action) {
    flex: 1;
    height: 24px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  :global(.icon-popover) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 260px;
    padding: 8px;
  }

  :global(.icon-popover) .icon-query,
  :global(.icon-popover) .icon-code {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
  }

  :global(.icon-popover) .icon-code {
    min-height: 160px;
    font-family: var(--ui-mono, monospace);
    resize: vertical;
  }

  :global(.icon-popover) .icon-results {
    display: flex;
    flex-direction: column;
    max-height: 220px;
    overflow-y: auto;
  }

  :global(.icon-popover) .icon-hit {
    padding: 4px 6px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  :global(.icon-popover) .icon-hit:hover {
    background: var(--ui-hover, rgb(128 128 128 / 0.15));
  }

  :global(.icon-popover) .group-label,
  :global(.icon-popover) .icon-note {
    padding: 4px 6px;
    opacity: 0.6;
  }
</style>
