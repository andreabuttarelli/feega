<script lang="ts">
  import { goto } from '$app/navigation';
  import X from '@lucide/svelte/icons/x';
  import GalleryPlayer from '$lib/components/gallery/GalleryPlayer.svelte';
  import FormatGlyph from '$lib/components/gallery/FormatGlyph.svelte';
  import KindGlyph from '$lib/components/gallery/KindGlyph.svelte';
  import DurationRange from '$lib/components/gallery/DurationRange.svelte';
  import { FILTER_GROUPS, filterHref, GALLERY_PATH, itemPath, KIND_LABEL, rangeHref, resultCount, SLIDER_MAX, type GalleryKind, type SearchParams } from '$lib/gallery/model';
  import type { MotionFormat } from '$lib/motion/doc';

  let { data } = $props();

  let hovered = $state<string | null>(null);

  const search = $derived(Object.fromEntries(Object.entries(data.search).filter(([k]) => k !== 'limit').map(([k, v]) => [k, v === undefined ? undefined : String(v)])) as SearchParams);
  const filtered = $derived(FILTER_GROUPS.some((g) => search[g.key]) || Boolean(search.tag || search.q || search.min || search.max));
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
        <span class="gx-group" role="group" aria-label={group.label}>
          {#each group.options as option (option.value)}
            {@const on = search[group.key] === option.value}
            <a class="gx-filter" class:on aria-current={on ? 'true' : undefined} title={on ? `Remove ${option.label}` : `Only ${option.label}`} href={filterHref(search, group.key, on ? null : option.value)}>
              {#if group.key === 'format'}<FormatGlyph format={option.value as MotionFormat} />{:else}<KindGlyph kind={option.value as GalleryKind} />{/if}
              {option.label}
            </a>
          {/each}
        </span>
      {/each}
      <DurationRange min={Number(search.min ?? 0)} max={Number(search.max ?? SLIDER_MAX)} onchange={(range) => goto(rangeHref(search, range), { keepFocus: true, noScroll: true })} />
    </nav>

    <form class="gx-search" method="GET" action={GALLERY_PATH} role="search">
      {#each Object.entries(search) as [key, value] (key)}
        {#if value && key !== 'q'}<input type="hidden" name={key} {value} />{/if}
      {/each}
      <input name="q" value={search.q ?? ''} placeholder="Search" aria-label="Search titles" />
    </form>
  </div>

  <div class="gx-status">
    <span data-testid="gallery-count">{resultCount(data.cards.length)}</span>
    {#if search.tag}<a class="gx-chip" href={filterHref(search, 'tag', null)} title="Remove tag">#{search.tag} <X size={11} /></a>{/if}
    {#if filtered}<a class="gx-reset" href={GALLERY_PATH}>Reset filters</a>{/if}
  </div>

  {#if data.cards.length}
    <ul class="gx-grid" data-testid="gallery-grid">
      {#each data.cards as card (card.id)}
        <li>
          <a class="gx-card" href={itemPath(card.id)} onpointerenter={() => (hovered = card.id)} onpointerleave={() => (hovered = null)} onfocus={() => (hovered = card.id)} onblur={() => (hovered = null)}>
            <GalleryPlayer id={card.id} format={card.format} posterUrl={card.posterUrl} previewUrl={card.previewUrl} hovered={hovered === card.id} />
            <span class="gx-meta">
              <span class="gx-title">{card.title}</span>
              <span class="gx-glyphs">
                <span title={KIND_LABEL[card.kind]}><KindGlyph kind={card.kind} /></span>
                <span title={card.format}><FormatGlyph format={card.format} /></span>
              </span>
            </span>
            <span class="gx-author">{card.authorName}{card.remixedFrom ? ` · remix of ${card.remixedFrom.title}` : ''}</span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="gx-empty" data-testid="gallery-empty">
      <p>{filtered ? 'No results for these filters.' : 'Nothing here yet.'}</p>
      {#if filtered}<a class="gx-reset" href={GALLERY_PATH}>Reset filters</a>{/if}
    </div>
  {/if}
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    font-size: var(--ui-text-md);
  }

  h1 {
    margin: 0;
    font-size: var(--ui-text-xl);
    font-weight: 600;
    line-height: 28px;
    letter-spacing: -0.02em;
  }

  .gx-head p {
    margin: var(--ui-space-1) 0 0;
    line-height: 20px;
    color: var(--ui-ink-3);
  }

  .gx-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-4);
    margin-top: var(--ui-space-2);
  }

  .gx-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-2) var(--ui-space-8);
  }

  .gx-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
    margin-left: calc(-1 * var(--ui-space-2));
  }

  .gx-group + .gx-group {
    margin-left: 0;
  }

  .gx-filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 var(--ui-space-2);
    color: var(--ui-ink-3);
    font-size: var(--ui-text-sm);
    line-height: 1;
    transition: color 120ms ease, background-color 120ms ease;
  }

  .gx-filter:hover {
    color: var(--ui-ink);
    background: var(--ui-hover);
  }

  .gx-filter:focus-visible,
  .gx-reset:focus-visible,
  .gx-chip:focus-visible,
  .gx-card:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .gx-filter.on {
    color: var(--ui-ink);
    background: var(--ui-surface);
    font-weight: 500;
  }

  .gx-filter:active {
    background: var(--ui-line);
  }

  .gx-search input {
    width: 200px;
    height: 28px;
    padding: 0 var(--ui-space-2);
    border: 0;
    background: var(--ui-surface);
    color: var(--ui-ink);
    font-size: var(--ui-text-sm);
    transition: background-color 120ms ease;
  }

  .gx-search input:hover {
    background: var(--ui-hover);
  }

  .gx-search input:focus {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .gx-status {
    display: flex;
    align-items: center;
    gap: var(--ui-space-3);
    min-height: 20px;
    margin-top: calc(-1 * var(--ui-space-2));
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
    font-variant-numeric: tabular-nums;
  }

  .gx-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ui-ink);
  }

  .gx-reset {
    color: var(--ui-ink-2);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .gx-reset:hover {
    color: var(--ui-ink);
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
    min-width: 0;
  }

  .gx-card :global(.player) {
    margin-bottom: var(--ui-space-3);
    transition: opacity 160ms ease;
  }

  .gx-card:hover :global(.player) {
    opacity: 0.96;
  }

  .gx-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    height: 18px;
  }

  .gx-title {
    font-size: var(--ui-text-sm);
    font-weight: 500;
    line-height: 18px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gx-glyphs {
    display: inline-flex;
    align-items: center;
    height: 18px;
    gap: var(--ui-space-2);
    color: var(--ui-ink-3);
  }

  .gx-author {
    font-size: var(--ui-text-xs);
    line-height: 16px;
    color: var(--ui-ink-3);
  }

  .gx-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2);
    padding: var(--ui-space-8) 0;
    color: var(--ui-ink-3);
  }

  .gx-empty p {
    margin: 0;
  }

  @media (max-width: 640px) {
    .gx-filters {
      gap: var(--ui-space-2);
    }

    .gx-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--ui-space-6);
    }

    .gx-search,
    .gx-search input {
      width: 100%;
      height: 36px;
    }

    .gx-filter {
      height: 32px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gx-filter,
    .gx-card :global(.player) {
      transition: none;
    }
  }
</style>
