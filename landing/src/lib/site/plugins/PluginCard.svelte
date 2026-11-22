<script lang="ts">
  import Pixel from '../alternatives/Pixel.svelte';
  import { eventAttrs } from '../analytics/attrs';
  import { lower } from '../lower';
  import { pluginPath, type PluginView } from './plugins';
  import TierBadge from './TierBadge.svelte';

  let { plugin }: { plugin: PluginView } = $props();
</script>

<a class="card" href={pluginPath(plugin.id)} {...eventAttrs('plugin_open', { id: plugin.id })}>
  <div class="top">
    <span class="icon"><Pixel icon={plugin.icon} size={6} /></span>
    <TierBadge tier={plugin.tier} />
  </div>

  <img class="cover" src={plugin.cover.src} alt={plugin.cover.alt} width={plugin.cover.width} height={plugin.cover.height} loading="lazy" decoding="async" />

  <h2>{lower(plugin.name)}</h2>
  <p class="summary">{lower(plugin.summary)}</p>

</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    border-radius: 10px;
    background: #000;
    color: var(--site-ink);
    text-decoration: none;
    transition: background 0.15s;
  }

  .card:hover,
  .card:focus-visible {
    background: var(--sx-grey-1);
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cover {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 10px;
    background: var(--sx-grey-1);
  }

  h2 {
    margin: 8px 0 0;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .summary {
    margin: 0;
    font-size: 16px;
    line-height: 1.4;
    opacity: 0.7;
  }
</style>
