<script lang="ts">
  import { page } from '$app/state';
  import { previewTags } from '$lib/social-preview';

  const tags = $derived(previewTags(page.url.origin + page.url.pathname, page.data.socialImage));
</script>

<svelte:head>
  {#each tags as tag (tag.id)}
    {#if tag.key === 'property'}
      <meta property={tag.id} content={tag.content} />
    {:else}
      <meta name={tag.id} content={tag.content} />
    {/if}
  {/each}
</svelte:head>
