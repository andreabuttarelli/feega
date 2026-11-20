<script lang="ts">
  import { page } from '$app/state';
  import Mark from './Mark.svelte';
  import { DOWNLOAD_PATH, GITHUB_URL, HEADER_LINKS, DOCS_URL, STORY_URL } from './links';

  const isCurrent = (href: string) => {
    if (href === DOCS_URL || href === STORY_URL) {
      return false;
    }

    return page.url.pathname === href;
  };
</script>

<header class="sx-nav">
  <a class="sx-brand" href="/" aria-label="Feega home"><Mark size={22} /><span>feega</span></a>

  <nav class="sx-links" aria-label="Main">
    {#each HEADER_LINKS as link (link.label)}
      <a class="sx-pill" href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label.toLowerCase()}</a>
    {/each}
  </nav>

  <div class="sx-actions">
    <a class="sx-pill" href={GITHUB_URL}>star on github</a>
    <a class="sx-pill sx-cta" href={DOWNLOAD_PATH}>download</a>
  </div>

  <details class="sx-menu">
    <summary class="sx-pill" aria-label="Menu">menu</summary>
    <nav class="sx-menu-panel" aria-label="Menu">
      {#each HEADER_LINKS as link (link.label)}
        <a href={link.href}>{link.label.toLowerCase()}</a>
      {/each}
      <a href={GITHUB_URL}>star on github</a>
      <a href={DOWNLOAD_PATH}>download</a>
    </nav>
  </details>
</header>
