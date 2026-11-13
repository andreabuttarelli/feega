<script lang="ts">
  import { apiEnhance } from '$lib/dashboard/api-enhance';

  type Item = { id: string; name: string; description: string; thumbnail: string };

  let { title, items, projectId = null }: { title: string; items: Item[]; projectId?: string | null } = $props();

  let starting = $state<string | null>(null);
</script>

<section class="shelf" aria-label={title} data-testid="node-templates-{title}">
  <h2>{title}</h2>
  <ul class="grid">
    {#each items as item (item.id)}
      <li data-template={item.id}>
        <form method="POST" action="/app?/fromCanvasTemplate" use:apiEnhance onsubmit={() => (starting = item.id)}>
          <input type="hidden" name="template" value={item.id} />
          {#if projectId}<input type="hidden" name="projectId" value={projectId} />{/if}
          <span class="poster"><img src={item.thumbnail} alt="" loading="lazy" decoding="async" width="240" height="300" /></span>
          <span class="name">{item.name}</span>
          <span class="meta">{item.description}</span>
          <button type="submit" class="use" disabled={starting !== null}>{starting === item.id ? 'opening…' : 'use in new canvas'}</button>
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

  h2 {
    margin: 0;
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking-caps);
    color: var(--ui-text-tertiary);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--ui-space-4);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .poster {
    display: block;
    aspect-ratio: 4 / 5;
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

  .name {
    font-size: var(--ui-type-label);
    font-weight: 500;
    color: var(--ui-text);
  }

  .meta {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }

  .use {
    align-self: flex-start;
    height: 28px;
    margin-top: var(--ui-space-2);
    padding: 0 var(--ui-space-3);
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }

  .use:hover {
    background: var(--ui-wash);
  }
</style>
