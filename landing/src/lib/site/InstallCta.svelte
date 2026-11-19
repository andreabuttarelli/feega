<script lang="ts">
  import { installAction, primaryCta, secondaryCtas } from './install';

  let { id }: { id: string } = $props();

  const primary = primaryCta();
  const secondary = secondaryCtas();
</script>

<div class="install" data-agent-id={id}>
  <a class="primary" href={primary.href} use:installAction={primary}>{primary.label}</a>
  <p class="more">
    {#each secondary as cta (cta.label)}<a href={cta.href}>{cta.label}</a>{/each}
  </p>
  <p class="note">free. no AI, no tokens. every change shown as a diff.</p>
</div>

<style>
  .install {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: #fff;
  }

  .primary {
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
