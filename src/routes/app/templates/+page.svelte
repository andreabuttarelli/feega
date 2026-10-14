<script lang="ts">
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import ComponentShelf from '$lib/components/app/ComponentShelf.svelte';
  import PosterShelf from '$lib/components/app/PosterShelf.svelte';
  import { GALLERY_PATH, byline, itemPath } from '$lib/gallery/model';

  let { data } = $props();
</script>

<svelte:head><title>Frame templates · feega</title></svelte:head>

<div class="templates">
  <PageHeader title="frame templates" lede="each one opens a new canvas with the frame already in it." />

  <ComponentShelf items={data.components} projectId={data.attachProjectId} />

  {#if data.posters.length}<PosterShelf items={data.posters} projectId={data.attachProjectId} />{/if}

  {#if data.gallery.length}
    <section class="shelf" aria-labelledby="gallery-heading">
      <div class="head">
        <h2 id="gallery-heading">remix from the gallery</h2>
        <a class="quiet" href={GALLERY_PATH} data-sveltekit-reload>see all</a>
      </div>
      <ul class="strip" data-testid="templates-gallery">
        {#each data.gallery as card (card.id)}
          <li>
            <a href={itemPath(card.id)} class="card" data-sveltekit-reload>
              <span class="poster">
                {#if card.posterUrl}<img src={card.posterUrl} alt="" loading="lazy" decoding="async" width="240" height="135" />{/if}
              </span>
              <span class="title">{card.title}</span>
              <span class="meta">{byline(card)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .templates {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 64px;
    color: var(--ui-text);
  }

  .shelf {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
  }

  h2 {
    margin: 0;
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking-caps);
    color: var(--ui-text-tertiary);
  }

  .quiet {
    height: 32px;
    padding: 0 var(--ui-space-3);
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-tertiary);
    font-size: var(--ui-type-label);
    line-height: 32px;
    text-decoration: none;
  }

  .quiet:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(160px, 1fr);
    gap: var(--ui-space-3);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--ui-text);
    text-decoration: none;
  }

  .poster {
    display: block;
    aspect-ratio: 16 / 9;
    margin-bottom: var(--ui-space-2);
    overflow: hidden;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-sunken);
  }

  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .title {
    overflow: hidden;
    font-size: var(--ui-type-label);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }

  @media (max-width: 640px) {
    .templates {
      gap: 48px;
    }
  }
</style>
