<script lang="ts">
  import { APP_URL, HEADER_LINKS, MENU_LINKS } from './links';

  let open = $state(false);
</script>

<header class="bar">
  <div class="row">
    <a class="site-brand" href="/"><span>Feega</span><span aria-hidden="true">Andrea Buttarelli</span></a>

    <nav class="links" aria-label="Main">
      {#each HEADER_LINKS as link (link.href)}
        <a href={link.href}>{link.label}</a>
      {/each}
    </nav>

    <a class="cta" href={APP_URL}>Let’s start</a>

    <button class="toggle" type="button" aria-expanded={open} onclick={() => (open = !open)}>
      {open ? 'Close' : 'Menu'}
    </button>
  </div>

  {#if open}
    <nav class="drawer" aria-label="Menu">
      {#each MENU_LINKS as link (link.href)}
        <a href={link.href} onclick={() => (open = false)}>{link.label}</a>
      {/each}
    </nav>
  {/if}
</header>

<style>
  .bar {
    position: fixed;
    inset: 0 0 auto;
    z-index: 10;
    mix-blend-mode: difference;
    max-width: 430px;
    margin: 0 auto;
    padding: var(--site-gutter);
  }

  .site-brand {
    display: grid;
    overflow: hidden;
    height: 1.2em;
  }

  .site-brand span {
    grid-area: 1 / 1;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .site-brand span + span {
    transform: translateY(110%);
  }

  .site-brand:hover span:first-child {
    transform: translateY(-110%);
  }

  .site-brand:hover span + span {
    transform: none;
  }

  .row {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: start;
    height: 18px;
  }

  .links,
  .cta {
    display: none;
  }

  .toggle {
    font: inherit;
    letter-spacing: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .drawer {
    position: fixed;
    inset: 0;
    max-width: 430px;
    margin: 0 auto;
    padding: 393px 20px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
    background: var(--site-bg);
    font-size: 44px;
    line-height: 0.9;
    letter-spacing: -0.04em;
  }

  @media (min-width: 1200px) {
    .bar {
      max-width: 1500px;
      background: var(--site-bg);
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: var(--site-gutter);
      height: 21px;
    }

    .site-brand {
      grid-column: 1;
      grid-row: 1;
      justify-self: start;
    }

    .links {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      flex-direction: row;
      gap: 24px;
    }

    .cta {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      display: block;
      border-bottom: 1px solid var(--site-ink);
    }

    .toggle,
    .drawer {
      display: none;
    }
  }
</style>
