<script lang="ts">
  import { FORMATS } from '$lib/motion/doc';
  import { POSTER_FORMATS, type CatalogueItem, type PosterFormat } from '$lib/motion/template/catalogue';

  let { items, projectId = null }: { items: CatalogueItem[]; projectId?: string | null } = $props();

  let format = $state<PosterFormat>(POSTER_FORMATS[0]);
  let starting = $state<string | null>(null);
</script>

<section class="shelf" aria-labelledby="posters-heading" data-testid="home-posters">
  <div class="head">
    <h2 id="posters-heading">posters</h2>
    <div class="formats" role="radiogroup" aria-label="Format">
      {#each POSTER_FORMATS as f (f)}
        <button type="button" role="radio" aria-checked={format === f} class:on={format === f} data-format={f} onclick={() => (format = f)}>{FORMATS[f].label}</button>
      {/each}
    </div>
  </div>

  <ul class="strip">
    {#each items as item (item.id)}
      <li data-poster={item.id}>
        <form method="POST" action="/app?/fromTemplate" onsubmit={() => (starting = item.id)}>
          <input type="hidden" name="template" value={item.id} />
          <input type="hidden" name="format" value={format} />
          {#if projectId}<input type="hidden" name="projectId" value={projectId} />{/if}
          <button type="submit" class="picture" aria-label={`Use ${item.name}`} disabled={starting !== null}>
            {#if item.preview}<img src={item.preview.poster} alt="" loading="lazy" decoding="async" width="240" height="300" />{/if}
          </button>
          <span class="name">{item.name}</span>
          <button type="submit" class="use" data-testid="use-poster" disabled={starting !== null}>{starting === item.id ? 'opening…' : 'use in new poster'}</button>
        </form>
      </li>
    {/each}
  </ul>
</section>

<style>
  .shelf {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-3);
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

  .formats {
    display: flex;
    gap: 6px;
  }

  .formats button {
    flex: none;
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
    color: var(--ui-text-tertiary);
    font: inherit;
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }

  .formats button.on {
    background: var(--ui-input);
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
    grid-auto-columns: minmax(160px, 200px);
    gap: var(--ui-space-3);
    overflow-x: auto;
    scrollbar-width: none;
    scroll-snap-type: x proximity;
  }

  .strip li :global(:is(.preview, video, img)) {
    border-radius: var(--ui-radius-md);
  }

  .strip li {
    scroll-snap-align: start;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .picture {
    border-radius: var(--ui-radius-md);
    overflow: hidden;
    display: block;
    aspect-ratio: 4 / 5;
    padding: 0;
    border: 0;
    overflow: hidden;
    background: var(--ui-panel-sunken);
    cursor: pointer;
  }

  .picture img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 200ms ease;
  }

  .picture:hover:not(:disabled) img {
    opacity: 0.88;
  }

  .name {
    margin-top: var(--ui-space-2);
    overflow: hidden;
    font-size: var(--ui-type-label);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .use {
    align-self: flex-start;
    height: 30px;
    margin-top: var(--ui-space-2);
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }

  .use:hover:not(:disabled) {
    background: var(--ui-wash);
  }

  .use:disabled,
  .picture:disabled {
    opacity: 0.6;
    cursor: default;
  }

  @media (max-width: 640px) {
    .strip {
      grid-auto-columns: 46%;
    }
  }
</style>
