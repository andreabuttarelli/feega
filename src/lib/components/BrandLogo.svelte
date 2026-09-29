<script lang="ts">
  let { name, url }: { name: string; url: string | null | undefined } = $props();

  let failedUrl = $state<string | null>(null);
  const showsImage = $derived(Boolean(url) && failedUrl !== url);
  const initials = $derived(name.trim().slice(0, 2).toUpperCase());
</script>

{#if showsImage}
  <img class="brand-logo-img" src={url} alt="" loading="lazy" decoding="async" onerror={() => (failedUrl = url ?? null)} />
{:else}
  <span class="brand-logo-ph" aria-hidden="true">{initials}</span>
{/if}

<style>
  .brand-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .brand-logo-ph {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    font-size: inherit;
    font-weight: 700;
    color: var(--ink-soft);
    background: var(--paper-3, var(--paper-2));
  }
</style>
