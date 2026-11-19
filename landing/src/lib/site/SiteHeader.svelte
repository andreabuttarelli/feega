<script lang="ts">
  import Mark from './Mark.svelte';
  import { DOWNLOAD_PATH, GITHUB_URL, HEADER_LINKS, MENU_LINKS, SOCIAL_LINKS } from './links';
  import { GITHUB_ICON } from './social-icons';

  let open = $state(false);
</script>

<header class="bar">
  <a class="chip brand" href="/" aria-label="Feega home"><Mark size={16} /><span>feega</span></a>

  <nav class="links" aria-label="Main">
    {#each HEADER_LINKS as link (link.label)}
      <a class="chip" href={link.href}>{link.label.toLowerCase()}</a>
    {/each}
  </nav>

  <div class="actions">
    <a class="chip" href={GITHUB_URL}>star on github</a>
    <a class="chip cta" href={DOWNLOAD_PATH}>download</a>
  </div>

  <div class="mobile">
    <a class="github" href={GITHUB_URL} aria-label="Feega on GitHub">{@html GITHUB_ICON}</a>
    <button class="toggle" type="button" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} onclick={() => (open = !open)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
        {#if open}
          <path d="M6 6l12 12M18 6L6 18" />
        {:else}
          <path d="M4 8h16M4 16h16" />
        {/if}
      </svg>
    </button>
  </div>
</header>

{#if open}
  <nav class="drawer" aria-label="Menu">
    <div class="menu">
      {#each MENU_LINKS as link (link.label)}
        <a href={link.href} onclick={() => (open = false)}>{link.label.toLowerCase()}</a>
      {/each}
      <a href={GITHUB_URL}>star on github</a>
    </div>

    <div class="follow">
      <p>follow our open building</p>
      <div class="icons">
        {#each SOCIAL_LINKS as social (social.label)}
          <a href={social.href} aria-label={social.label}>{@html social.icon}</a>
        {/each}
      </div>
    </div>
  </nav>
{/if}

<style>
  .bar {
    --nav-chip: 38px;
    position: absolute;
    inset: 0 0 auto;
    z-index: var(--site-z-header);
    display: flex;
    justify-content: space-between;
    align-items: start;
    padding: 28px 16px 12px;
    font-family: 'Inter', sans-serif;
    font-variation-settings: normal;
    font-size: 16px;
    line-height: 19.2px;
    letter-spacing: -0.03em;
    font-weight: 500;
  }

  :global(.star svg) {
    width: 14px;
    height: 14px;
    margin-right: 4px;
    vertical-align: -2px;
  }

  .bar :global(.chip) {
    display: block;
    padding: 8px 4px 10px;
    color: #fff;
    text-decoration: none;
  }

  .bar .brand {
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--nav-chip);
    padding: 0 10px 2px;
  }

  .links,
  .actions {
    display: none;
  }

  .mobile {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }

  .github,
  .toggle {
    display: grid;
    place-items: center;
    width: var(--nav-chip);
    height: var(--nav-chip);
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #000;
    color: #fff;
    cursor: pointer;
  }

  .github :global(svg),
  .toggle svg {
    width: 18px;
    height: 18px;
  }

  .drawer {
    position: fixed;
    inset: 0;
    z-index: var(--site-z-drawer);
    display: flex;
    flex-direction: column;
    max-width: 430px;
    margin: 0 auto;
    padding: 393px 20px 0;
    background: #000;
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 24px;
    font-size: 44px;
    line-height: 39.6px;
    letter-spacing: -0.04em;
  }

  .follow {
    margin-top: 120px;
    font-size: 14px;
    line-height: 16.8px;
  }

  .icons {
    display: flex;
    gap: 20px;
    margin-top: 16px;
  }

  .icons :global(svg) {
    width: 20px;
    height: 20px;
  }

  @media (min-width: 1200px) {
    .bar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      padding: 28px 20px 0;
    }

    .links {
      display: flex;
      gap: 8px;
    }

    .actions {
      display: flex;
      justify-content: end;
      gap: 8px;
    }

    .brand {
      justify-self: start;
    }

    .bar :global(.star) {
      background: #4f4f4f;
      color: #fff;
    }

    .bar .cta {
      padding: 8px 16px 10px;
      border-radius: 999px;
      background: #ff5100;
    }

    .actions {
      align-items: center;
      gap: 24px;
    }

    .mobile,
    .drawer {
      display: none;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .bar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      padding: 28px 16px 0;
    }

    .links {
      display: flex;
      gap: 8px;
    }

    .actions {
      display: flex;
      justify-content: end;
      gap: 8px;
    }

    .brand {
      justify-self: start;
    }

    .bar :global(.star) {
      background: #4f4f4f;
      color: #fff;
    }

    .bar .cta {
      padding: 8px 16px 10px;
      border-radius: 999px;
      background: #ff5100;
    }

    .actions {
      align-items: center;
      gap: 24px;
    }

    .mobile,
    .drawer {
      display: none;
    }
  }
</style>
