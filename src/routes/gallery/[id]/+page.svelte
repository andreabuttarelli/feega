<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import { enhance } from '$app/forms';
  import GalleryPlayer from '$lib/components/gallery/GalleryPlayer.svelte';
  import { assetUrlMap, filterHref, GALLERY_PATH, itemPath, KIND_LABEL } from '$lib/gallery/model';

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

<article class="item" data-testid="gallery-item">
  <a class="back" href={GALLERY_PATH}><ArrowLeft size={14} /> Gallery</a>

  <div class="layout">
    <div class="stage">
      <GalleryPlayer id={item.id} format={item.format} posterUrl={item.posterUrl} previewUrl={null} {source} eager />
    </div>

    <aside class="side">
      <h1>{item.title}</h1>
      <p class="byline" data-testid="gallery-byline">
        by <strong>{item.authorName}</strong>
        {#if item.remixedFrom}· remix of <a href={itemPath(item.remixedFrom.id)}>{item.remixedFrom.title}</a>{/if}
      </p>
      {#if item.description}<p class="description">{item.description}</p>{/if}

      <dl class="facts">
        <dt>Type</dt><dd>{KIND_LABEL[item.kind]}</dd>
        <dt>Format</dt><dd>{item.format}</dd>
        <dt>Length</dt><dd>{item.durationS} s</dd>
        <dt>Remixes</dt><dd>{item.remixCount}</dd>
      </dl>

      {#if item.tags.length}
        <p class="tags">{#each item.tags as tag (tag)}<a href={filterHref({}, 'tag', tag)}>#{tag}</a>{/each}</p>
      {/if}

      {#if data.signedIn}
        <form
          method="POST"
          action="?/remix"
          class="remix"
          use:enhance={() => {
            busy = true;
            return async ({ update }) => {
              await update();
              busy = false;
            };
          }}
        >
          {#if data.projects.length > 1}
            <label>
              <span>Into project</span>
              <select name="project">
                {#each data.projects as project (project.id)}<option value={project.id}>{project.name}</option>{/each}
              </select>
            </label>
          {:else if data.projects.length === 1}
            <input type="hidden" name="project" value={data.projects[0].id} />
          {/if}
          <button type="submit" class="primary" disabled={busy || !data.projects.length} data-testid="remix"><Shuffle size={14} /> {busy ? 'Copying…' : 'Remix'}</button>
          {#if !data.projects.length}<p class="muted">Create a project first, then remix it there.</p>{/if}
        </form>
      {:else}
        <form method="POST" action="?/signin" class="remix">
          <button type="submit" class="primary" data-testid="remix-signin"><Shuffle size={14} /> Sign in to remix</button>
        </form>
      {/if}
      {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
      <p class="muted">Free. A copy lands in your project with its texts, colours and media ready to change, then the agent can put your brand on it.</p>
    </aside>
  </div>
</article>

<style>
  .item {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-1);
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space-6);
  }

  .stage {
    width: 100%;
    max-height: 78dvh;
    display: flex;
    justify-content: center;
    background: var(--ui-surface);
  }

  .stage :global(.player) {
    max-height: 78dvh;
    width: auto;
    max-width: 100%;
    flex: 1;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
  }

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .byline {
    margin: 0;
    font-size: var(--ui-text-md);
    color: var(--ui-ink-2);
  }

  .byline a {
    text-decoration: underline;
  }

  .description {
    margin: 0;
    font-size: var(--ui-text-md);
    line-height: 1.5;
  }

  .facts {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--ui-space-1) var(--ui-space-3);
    margin: 0;
    font-size: var(--ui-text-sm);
  }

  dt {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    text-transform: uppercase;
    color: var(--ui-ink-3);
  }

  dd {
    margin: 0;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }

  .remix {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .remix label {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }

  select {
    height: 36px;
    padding: 0 var(--ui-space-2);
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
  }

  .primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    padding: 0 var(--ui-space-4);
    border: 0;
    background: var(--ui-ink);
    color: var(--ui-bg);
    font-size: var(--ui-text-md);
    font-weight: 600;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .muted {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .error {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-danger);
  }

  @media (min-width: 1024px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 320px;
      align-items: start;
    }

    .side {
      position: sticky;
      top: calc(var(--ui-bar-h) + var(--ui-space-8));
    }
  }
</style>
