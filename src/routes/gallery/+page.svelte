<script lang="ts">
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import GalleryPlayer from '$lib/components/gallery/GalleryPlayer.svelte';
  import { byline, FILTER_GROUPS, filterHref, GALLERY_PATH, itemPath, KIND_LABEL } from '$lib/gallery/model';

  let { data } = $props();

  const search = $derived(data.g-search as Record<string, string | undefined>);
  const active = $derived(FILTER_GROUPS.some((g) => search[g.key]) || Boolean(search.tag) || Boolean(search.q));
</script>

<svelte:head>
  <title>Gallery · feega</title>
  <meta name="description" content="Free motion videos and 3D compositions made with feega. Remix any of them into your own project." />
</svelte:head>

<div class="gallery">
  <header class="g-head">
    <h1>Gallery</h1>
    <p class="g-lede">Motion videos and compositions anyone can remix, free.</p>
  </header>

  <form class="g-search" method="GET" action={GALLERY_PATH}>
    {#each FILTER_GROUPS as group (group.key)}
      {#if search[group.key]}<input type="hidden" name={group.key} value={search[group.key]} />{/if}
    {/each}
    <input name="q" value={search.q ?? ''} placeholder="Search titles" aria-label="Search titles" />
  </form>

  <nav class="g-filters" aria-label="Filters" data-testid="gallery-filters">
    {#each FILTER_GROUPS as group (group.key)}
      <div class="g-group">
        <span class="g-g-group-label">{group.label}</span>
        {#each group.options as option (option.value)}
          {@const on = search[group.key] === option.value}
          <a class="g-chip" class:on aria-current={on ? 'true' : undefined} href={filterHref(search, group.key, on ? null : option.value)}>{option.label}</a>
        {/each}
      </div>
    {/each}
    {#if search.tag}<a class="g-chip on" href={filterHref(search, 'tag', null)}>#{search.tag} ×</a>{/if}
    {#if active}<a class="g-clear" href={GALLERY_PATH}>Clear</a>{/if}
  </nav>

  {#if data.cards.length}
    <ul class="g-grid" data-testid="gallery-grid">
      {#each data.cards as card (card.id)}
        <li class="g-card">
          <a href={itemPath(card.id)} aria-label={card.title}>
            <GalleryPlayer id={card.id} format={card.format} posterUrl={card.posterUrl} previewUrl={card.previewUrl} />
          </a>
          <div class="g-meta">
            <a class="g-title" href={itemPath(card.id)}>{card.title}</a>
            <span class="g-muted">{byline(card)}</span>
            <span class="g-facts">
              <span>{KIND_LABEL[card.kind]}</span>
              <span>{card.format}</span>
              <span>{card.durationS} s</span>
              {#if card.remixCount}<span class="g-remixes"><Shuffle size={11} /> {card.remixCount}</span>{/if}
            </span>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="g-empty" data-testid="gallery-empty">Nothing here yet{active ? ' with these filters' : ''}.</p>
  {/if}
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .g-lede {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-ink-2);
    font-size: var(--ui-text-lg);
  }

  .g-search input {
    width: 100%;
    max-width: 360px;
    height: 36px;
    padding: 0 var(--ui-space-3);
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-size: var(--ui-text-md);
  }

  .g-search input:focus {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .g-filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2) var(--ui-space-6);
    align-items: center;
  }

  .g-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-1);
  }

  .g-group-label {
    margin-right: var(--ui-space-1);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ui-ink-3);
  }

  .g-chip {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 var(--ui-space-2);
    border: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }

  .g-chip:hover {
    background: var(--ui-hover);
  }

  .g-chip.on {
    border-color: var(--ui-ink);
    background: var(--ui-ink);
    color: var(--ui-bg);
  }

  .g-clear {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
    text-decoration: underline;
  }

  .g-grid {
    list-style: none;
    margin: var(--ui-space-2) 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--ui-space-6) var(--ui-space-4);
    align-items: start;
  }

  .g-card {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    min-width: 0;
  }

  .g-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .g-title {
    font-size: var(--ui-text-md);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .g-muted,
  .g-facts {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .g-facts {
    display: flex;
    gap: var(--ui-space-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
  }

  .g-remixes {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .g-empty {
    padding: var(--ui-space-8) 0;
    color: var(--ui-ink-3);
  }

  @media (max-width: 640px) {
    .g-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4) var(--ui-space-2);
    }

    h1 {
      font-size: 22px;
    }
  }
</style>
