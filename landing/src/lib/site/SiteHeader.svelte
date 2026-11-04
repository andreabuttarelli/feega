<script lang="ts">
  import { APP_URL, GITHUB_URL, HEADER_LINKS, MENU_LINKS, SOCIAL_LINKS } from './links';

  let open = $state(false);
</script>

<header class="bar">
  <a class="chip brand" href="/">Feega</a>

  <nav class="links" aria-label="Main">
    {#each HEADER_LINKS as link (link.label)}
      <a class="chip" href={link.href}>{link.label}</a>
    {/each}
  </nav>

  <div class="actions">
    <a class="chip star" href={GITHUB_URL}><span>Star us</span></a>
    <a class="chip cta" href={APP_URL}><span>Let’s start</span></a>
  </div>

  <button class="toggle" type="button" aria-expanded={open} onclick={() => (open = !open)}>
    {open ? 'Close' : 'Menu'}
  </button>
</header>

{#if open}
  <nav class="drawer" aria-label="Menu">
    <div class="menu">
      {#each MENU_LINKS as link (link.label)}
        <a href={link.href} onclick={() => (open = false)}>{link.label}</a>
      {/each}
    </div>

    <div class="follow">
      <p>Follow our open building</p>
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
    position: fixed;
    inset: 0 0 auto;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: start;
    max-width: 430px;
    margin: 0 auto;
    padding: 12px;
    font-family: 'Inter', sans-serif;
    font-variation-settings: normal;
    font-size: 16px;
    line-height: 19.2px;
    letter-spacing: -0.03em;
    font-weight: 500;
  }

  .chip {
    display: block;
    padding: 8px 4px 10px;
    background: #fff;
    color: #000;
  }

  .brand {
    padding: 8px 10px 10px;
  }

  .links,
  .actions {
    display: none;
  }

  .toggle {
    margin-top: 10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--site-ink);
    font-family: 'BDO Grotesk', sans-serif;
    font-variation-settings: 'wght' 500;
    font-size: 14px;
    line-height: 16.8px;
    letter-spacing: -0.02em;
    cursor: pointer;
  }

  .drawer {
    position: fixed;
    inset: 0;
    z-index: 9;
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

  @media (min-width: 810px) {
    .bar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      max-width: none;
      padding: 0 20px;
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

    .star {
      background: #4f4f4f;
      color: #fff;
    }

    .cta {
      background: #ff5100;
    }

    .actions span {
      border-bottom: 1px solid currentColor;
    }

    .toggle,
    .drawer {
      display: none;
    }
  }
</style>
