<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { enhance } from '$app/forms';
  import GalleryPlayer from '$lib/components/gallery/GalleryPlayer.svelte';
  import FormatGlyph from '$lib/components/gallery/FormatGlyph.svelte';
  import KindGlyph from '$lib/components/gallery/KindGlyph.svelte';
  import { assetUrlMap, GALLERY_PATH, itemPath, KIND_LABEL, Playback } from '$lib/gallery/model';

  let { data, form } = $props();

  let busy = $state(false);

  const item = $derived(data.item);
  const source = $derived({ doc: item.doc, assets: assetUrlMap(item.assets) });
</script>

<svelte:head>
  <title>{item.title} · feega gallery</title>
  <meta name="description" content={item.description || `${KIND_LABEL[item.kind]} by ${item.authorName}, free to remix on feega.`} />
  {#if item.posterUrl}<meta property="og:image" content={item.posterUrl} />{/if}
</svelte:head>

<article class="gx-item" data-testid="gallery-item">
  <a class="gx-back" href={GALLERY_PATH}>Gallery</a>

  <div class="gx-stage">
    <GalleryPlayer id={item.id} format={item.format} posterUrl={item.posterUrl} previewUrl={item.previewUrl} {source} playback={Playback.Always} />
  </div>

  <div class="gx-info">
    <div class="gx-text">
      <PageTitle text={item.title} />
      <p class="gx-byline" data-testid="gallery-byline">
        by {item.authorName}{#if item.remixedFrom} · remix of <a href={itemPath(item.remixedFrom.id)}>{item.remixedFrom.title}</a>{/if}
      </p>
      <p class="gx-facts">
        <span title="Type"><KindGlyph kind={item.kind} /> {KIND_LABEL[item.kind]}</span>
        <span title="Format"><FormatGlyph format={item.format} /> {item.format}</span>
        <span title="Length">{item.durationS} s</span>
      </p>
      {#if item.description}<p class="gx-description">{item.description}</p>{/if}
    </div>

    {#if data.signedIn}
      <form
        method="POST"
        action="?/remix"
        class="gx-remix"
        use:enhance={() => {
          busy = true;
          return async ({ update }) => {
            await update();
            busy = false;
          };
        }}
      >
        {#if data.projects.length > 1}
          <select name="project" aria-label="Into project">
            {#each data.projects as project (project.id)}<option value={project.id}>{project.name}</option>{/each}
          </select>
        {:else if data.projects.length === 1}
          <input type="hidden" name="project" value={data.projects[0].id} />
        {/if}
        <button type="submit" class="gx-primary" disabled={busy || !data.projects.length} data-testid="remix">{busy ? 'Copying…' : 'Remix'}</button>
      </form>
    {:else}
      <form method="POST" action="?/signin" class="gx-remix">
        <button type="submit" class="gx-primary" data-testid="remix-signin">Remix</button>
      </form>
    {/if}
  </div>
  {#if form?.error}<p class="gx-error" role="alert">{form.error}</p>{/if}
</article>

<style>
  .gx-item {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    font-size: var(--ui-text-md);
  }

  .gx-back {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .gx-back:hover {
    color: var(--ui-ink);
  }

  .gx-stage {
    display: flex;
    justify-content: center;
    background: var(--ui-surface);
  }

  .gx-stage :global(.player) {
    max-height: 72dvh;
    width: auto;
    max-width: 100%;
    flex: 1;
  }

  .gx-info {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--ui-space-4);
  }

  .gx-text {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    max-width: 640px;
  }

  .gx-byline {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .gx-facts {
    display: flex;
    gap: var(--ui-space-4);
    margin: var(--ui-space-1) 0 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }

  .gx-facts span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .gx-primary:hover:not(:disabled) {
    opacity: 0.88;
  }

  .gx-primary:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .gx-byline a {
    color: var(--ui-ink-2);
  }

  .gx-description {
    margin: var(--ui-space-2) 0 0;
    color: var(--ui-ink-2);
    line-height: 1.5;
  }

  .gx-remix {
    display: flex;
    gap: var(--ui-space-2);
  }

  select {
    height: 40px;
    padding: 0 var(--ui-space-2);
    border: 0;
    background: var(--ui-surface);
    color: var(--ui-ink);
  }

  .gx-primary {
    transition: opacity 120ms ease;
    height: 40px;
    min-width: 140px;
    padding: 0 var(--ui-space-6);
    border: 0;
    background: var(--ui-ink);
    color: var(--ui-bg);
    font-size: var(--ui-text-md);
    font-weight: 600;
    cursor: pointer;
  }

  .gx-primary:disabled {
    opacity: 0.5;
  }

  .gx-error {
    margin: 0;
    color: var(--ui-danger);
    font-size: var(--ui-text-sm);
  }

  @media (max-width: 640px) {
    .gx-remix,
    .gx-primary {
      width: 100%;
    }
  }
</style>
