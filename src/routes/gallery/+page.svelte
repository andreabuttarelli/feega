<script lang="ts">
  import GalleryPlayer from '$lib/components/gallery/GalleryPlayer.svelte';
  import { FILTER_GROUPS, filterHref, GALLERY_PATH, itemPath } from '$lib/gallery/model';

  let { data } = $props();

  let hovered = $state<string | null>(null);

  const search = $derived(data.search as unknown as Record<string, string | undefined>);
  const active = $derived(FILTER_GROUPS.some((g) => search[g.key]) || Boolean(search.tag) || Boolean(search.q));
</script>

<svelte:head>
  <title>Gallery · feega</title>
  <meta name="description" content="Free motion videos and 3D compositions made with feega. Remix any of them into your own project." />
</svelte:head>

<div class="gallery">
  <header class="gx-head">
    <h1>Gallery</h1>
    <p>Motion and compositions to remix, free.</p>
  </header>

  <div class="gx-tools">
    <nav class="gx-filters" aria-label="Filters" data-testid="gallery-filters">
      {#each FILTER_GROUPS as group (group.key)}
        <span class="gx-group">
          {#each group.options as option (option.value)}
            {@const on = search[group.key] === option.value}
            <a class="gx-filter" class:on aria-current={on ? 'true' : undefined} href={filterHref(search, group.key, on ? null : option.value)}>{option.label}</a>
          {/each}
        </span>
      {/each}
      {#if search.tag}<a class="gx-filter on" href={filterHref(search, 'tag', null)}>#{search.tag}</a>{/if}
      {#if active}<a class="gx-filter" href={GALLERY_PATH}>Clear</a>{/if}
    </nav>

    <form class="gx-search" method="GET" action={GALLERY_PATH}>
      {#each FILTER_GROUPS as group (group.key)}
        {#if search[group.key]}<input type="hidden" name={group.key} value={search[group.key]} />{/if}
      {/each}
      <input name="q" value={search.q ?? ''} placeholder="Search" aria-label="Search titles" />
    </form>
  </div>

  {#if data.cards.length}
    <ul class="gx-grid" data-testid="gallery-grid">
      {#each data.cards as card (card.id)}
        <li>
          <a class="gx-card" href={itemPath(card.id)} onpointerenter={() => (hovered = card.id)} onpointerleave={() => (hovered = null)}>
            <GalleryPlayer id={card.id} format={card.format} posterUrl={card.posterUrl} previewUrl={card.previewUrl} hovered={hovered === card.id} />
            <span class="gx-title">{card.title}</span>
            <span class="gx-author">{card.authorName}{card.remixedFrom ? ` · remix of ${card.remixedFrom.title}` : ''}</span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="gx-empty" data-testid="gallery-empty">Nothing here yet{active ? ' with these filters' : ''}.</p>
  {/if}
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-8);
    font-size: var(--ui-text-md);
  }

  h1 {
    margin: 0;
    font-size: var(--ui-text-xl);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .gx-head p {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-ink-3);
  }

  .gx-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-4);
  }

  .gx-filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2) var(--ui-space-6);
  }

  .gx-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1) var(--ui-space-3);
  }

  .gx-filter {
    color: var(--ui-ink-3);
    font-size: var(--ui-text-sm);
  }

  .gx-filter:hover {
    color: var(--ui-ink);
  }

  .gx-filter.on {
    color: var(--ui-ink);
    font-weight: 500;
  }

  .gx-search input {
    width: 180px;
    height: 28px;
    padding: 0 var(--ui-space-2);
    border: 0;
    background: var(--ui-surface);
    color: var(--ui-ink);
    font-size: var(--ui-text-sm);
  }

  .gx-search input:focus {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .gx-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--ui-space-8) var(--ui-space-6);
    align-items: start;
  }

  .gx-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .gx-card :global(.player) {
    margin-bottom: var(--ui-space-2);
  }

  .gx-title {
    font-size: var(--ui-text-sm);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gx-author {
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }

  .gx-empty {
    color: var(--ui-ink-3);
  }

  @media (max-width: 640px) {
    .gallery {
      gap: var(--ui-space-6);
    }

    .gx-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--ui-space-6);
    }

    .gx-search,
    .gx-search input {
      width: 100%;
    }
  }
</style>
