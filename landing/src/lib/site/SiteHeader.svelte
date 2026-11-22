<script lang="ts">
  import { page } from '$app/state';
  import Mark from './Mark.svelte';
  import { DOWNLOAD_PATH, GITHUB_URL, HEADER_LINKS, DOCS_URL, SOCIAL_LINKS, STORY_URL } from './links';
  import { GITHUB_ICON } from './social-icons';
  import LibraryMenu from './LibraryMenu.svelte';
  import { desktopNav } from './library-menu';
  import { eventAttrs } from './analytics/attrs';
  import { navAttrs } from './analytics/nav';

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
    {#each desktopNav as entry ('library' in entry ? 'library' : entry.label)}
      {#if 'library' in entry}
        <LibraryMenu freeTemplates={page.data.freeTemplates ?? 0} />
      {:else}
        <a class="sx-pill" href={entry.href} {...navAttrs(entry.href, 'header')} aria-current={isCurrent(entry.href) ? 'page' : undefined}>{entry.label.toLowerCase()}</a>
      {/if}
    {/each}
  </nav>

  <div class="sx-actions">
    <a class="sx-pill sx-star" href={GITHUB_URL} {...eventAttrs('github_click', { place: 'header' })}>star on github</a>
    <a class="sx-pill sx-cta" href={DOWNLOAD_PATH} {...eventAttrs('download_click', { target: 'download_page', place: 'header' })}>download</a>
  </div>

  <div class="sx-mobile">
    <a class="sx-round" href={GITHUB_URL} aria-label="Feega on GitHub" {...eventAttrs('github_click', { place: 'header_mobile' })}>{@html GITHUB_ICON}</a>

    <details class="sx-menu">
      <summary class="sx-round" aria-label="Menu">
        <svg class="sx-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg>
        <svg class="sx-close" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </summary>

      <nav class="sx-menu-panel" aria-label="Menu">
        <div class="sx-menu-links">
          {#each HEADER_LINKS as link (link.label)}
            <a href={link.href} {...navAttrs(link.href, 'header_menu')}>{link.label.toLowerCase()}</a>
          {/each}
          <a href={GITHUB_URL} {...eventAttrs('github_click', { place: 'header_menu' })}>star on github</a>
        </div>

        <div class="sx-menu-icons">
          {#each SOCIAL_LINKS as social (social.label)}
            <a href={social.href} aria-label={social.label}>{@html social.icon}</a>
          {/each}
        </div>

        <a class="sx-menu-cta" href={DOWNLOAD_PATH} {...eventAttrs('download_click', { target: 'download_page', place: 'header_menu' })}>download</a>
      </nav>
    </details>
  </div>
</header>
