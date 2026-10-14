<script lang="ts">
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import X from '@lucide/svelte/icons/x';
  import { itemPath } from '$lib/gallery/model';

  let { origin, onbrand }: { origin: { id: string; title: string; authorName: string }; onbrand: () => void } = $props();

  let open = $state(true);
</script>

{#if open}
  <div class="banner" role="status" data-testid="remix-banner">
    <Shuffle size={14} />
    <span>Remix of <a href={itemPath(origin.id)} target="_blank" rel="noopener">{origin.title}</a> by {origin.authorName}. Change its texts, colours and media in Properties, or</span>
    <button type="button" class="brand" onclick={onbrand} data-testid="remix-brand">apply my brand</button>
    <button type="button" class="close" aria-label="Dismiss" onclick={() => (open = false)}><X size={14} /></button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--ui-panel-sunken);
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-secondary);
    font-size: 12px;
    border-radius: var(--ui-radius-md);
  }

  a {
    color: var(--ui-text);
    text-decoration: underline;
  }

  .brand {
    padding: 2px 8px;
    border: 0;
    background: var(--ui-text);
    color: var(--ui-panel);
    font-size: 12px;
    font-weight: 600;
  }

  .close {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--ui-text-tertiary);
  }
</style>
