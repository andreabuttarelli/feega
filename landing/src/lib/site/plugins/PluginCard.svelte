<script lang="ts">
  import Pixel from '../alternatives/Pixel.svelte';
  import { eventAttrs } from '../analytics/attrs';
  import { lower } from '../lower';
  import { creditLine, pluginPath, type PluginView } from './plugins';
  import LabelBadges from './LabelBadges.svelte';
  import TierBadge from './TierBadge.svelte';

  let { plugin }: { plugin: PluginView } = $props();
</script>

<a class="card" href={pluginPath(plugin.id)} {...eventAttrs('plugin_open', { id: plugin.id })}>
  <div class="head">
    <span class="icon"><Pixel icon={plugin.icon} size={4} /></span>
    <h2>{lower(plugin.name)}</h2>
    <TierBadge tier={plugin.tier} />
  </div>

  <div class="labels"><LabelBadges labels={plugin.labels} /></div>

  <p class="summary">{lower(plugin.summary)}</p>
  {#if plugin.credit}<p class="credit">{lower(creditLine(plugin.credit))}</p>{/if}
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: var(--sx-grey-1);
  }

  .labels {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  h2 {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 16px;
    line-height: 1.4;
    opacity: 0.7;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .credit {
    margin: 0;
    font-family: var(--sx-mono);
    font-size: 13px;
    opacity: 0.5;
  }
</style>
