<script lang="ts">
  import { _ } from 'svelte-i18n';

  const EXTENSION_URL = 'https://marketplace.visualstudio.com/items?itemName=andreabuttarelli.feega';
  const GITHUB_URL = 'https://github.com/andreabuttarelli/feega';

  let { data } = $props();

  const first = $derived(data.name?.trim().split(/\s+/)[0] ?? '');
</script>

<svelte:head><title>Dashboard · Feega</title></svelte:head>

<div class="home" data-testid="home-hero">
  <h1>{first ? $_('app.dashboard.greeting', { values: { name: first } }) : $_('app.dashboard.greetingAnon')}</h1>
  <p class="lead">{$_('app.dashboard.cloud')}</p>
  <p class="aside">
    <a href={EXTENSION_URL}>{$_('app.dashboard.extension')}</a>
    <a href={GITHUB_URL}>{$_('app.dashboard.github')}</a>
  </p>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-space-3);
    max-width: 560px;
    margin: 0 auto;
    padding: clamp(64px, 18vh, 160px) var(--ui-space-4) var(--ui-space-8);
    text-align: center;
    color: var(--ui-text);
  }

  h1 {
    margin: 0 0 var(--ui-space-2);
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 600;
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    font-size: var(--ui-text-lg);
    line-height: var(--ui-leading);
  }

  .aside {
    display: flex;
    gap: var(--ui-space-4);
    font-size: var(--ui-type-body);
    color: var(--ui-text-tertiary);
  }

  a {
    color: var(--ui-text);
    text-decoration: underline;
    text-decoration-color: var(--ui-divider-strong);
    text-underline-offset: 3px;
  }

  a:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
    border-radius: var(--ui-radius-sm);
  }
</style>
