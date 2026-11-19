<script lang="ts">
  import { primaryCta, secondaryCtas, starCta } from './install';
  import DownloadDialog from './DownloadDialog.svelte';

  let { id }: { id: string } = $props();

  const primary = primaryCta();
  const secondary = secondaryCtas();
  let choosing = $state(false);
</script>

<div class="install" data-agent-id={id}>
  <div class="buttons">
    <button class="primary" onclick={() => (choosing = true)}>{primary.label}</button>
    <a class="star" href={starCta.href}>{starCta.label}</a>
  </div>
  <p class="more">
    {#each secondary as cta (cta.label)}<a href={cta.href}>{cta.label}</a>{/each}
  </p>
  <p class="note">free. no AI, no tokens. every change shown as a diff.</p>
</div>

<DownloadDialog bind:open={choosing} />

<style>
  .install {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: #fff;
  }

  .primary {
    border: 0;
    cursor: pointer;
    padding: 12px 26px;
    border-radius: 999px;
    background: #fff;
    color: #000;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-decoration: none;
    transition: opacity 0.15s;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .star {
    padding: 12px 26px;
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

  .primary:hover {
    opacity: 0.85;
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

  .note {
    margin: 0;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: rgb(255 255 255 / 0.5);
  }
</style>
