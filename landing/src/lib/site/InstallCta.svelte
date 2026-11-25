<script lang="ts">
  import { onMount } from 'svelte';
  import { secondaryCtas, starCta } from './install';
  import { detectOs, downloadFor, Os } from './desktop-download';
  import { DOWNLOAD_PATH } from './links';
  import InstallMenu from './InstallMenu.svelte';
  import { eventAttrs } from './analytics/attrs';

  let { id }: { id: string } = $props();

  let os = $state(Os.Unknown);

  const download = $derived(downloadFor(os));

  onMount(() => {
    os = detectOs(navigator.userAgent);
  });

  const secondary = secondaryCtas();

  const HERO_FACTS = ['free, forever', 'every edit a diff', 'no AI inside, no credits'] as const;
</script>

<div class="install" data-agent-id={id}>
  <div class="buttons">
    <InstallMenu {download} place={id} />
    <a class="star" href={starCta.href} {...eventAttrs('github_click', { place: id })}>{starCta.label}</a>
  </div>
  <p class="more">
    {#each secondary as cta (cta.label)}<a href={cta.href}>{cta.label}</a>{/each}
  </p>
  <ul class="facts">
    {#each HERO_FACTS as fact (fact)}<li>{fact}</li>{/each}
  </ul>
</div>

<style>
  .install.install {
    z-index: var(--site-z-agents);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: #fff;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .star {
    display: flex;
    align-items: center;
    min-height: 48px;
    line-height: 1;
    text-box: trim-both cap alphabetic;
    padding: 0 26px;
    border-radius: 999px;
    border: 1px solid rgb(255 255 255 / 0.3);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-decoration: none;
    transition: border-color 0.15s;
  }

  .star:hover {
    border-color: #fff;
  }

  .more {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 16px;
    margin: 0;
    font-size: 14px;
  }

  .more a {
    color: rgb(255 255 255 / 0.7);
    text-decoration: none;
  }

  .more a:hover {
    color: #fff;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 24px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    font-size: 15px;
    color: #fff;
  }

  .facts li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .facts li::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: var(--ui-radius-xs, 2px);
    background: #ff5100;
  }
</style>
