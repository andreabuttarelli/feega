<script lang="ts">
  import { lower } from '../lower';
  import type { PluginLabel } from './plugins';

  let { labels }: { labels: PluginLabel[] } = $props();
</script>

{#each labels as label (label)}<span class="badge" data-label={label}>{lower(label)}</span>{/each}

<style>
  .badge {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sx-pill);
    font-family: var(--sx-mono);
    font-size: 12px;
    color: var(--sx-ink-2);
  }

  .badge[data-label='Unofficial'] {
    opacity: 0.6;
  }
</style>
