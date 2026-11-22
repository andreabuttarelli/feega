<script lang="ts">
  import type { PluginTier } from './plugins';

  let { tier }: { tier: PluginTier } = $props();

  const label = $derived(tier === 'pro' ? 'pro' : 'free');
</script>

<span class="badge" class:pro={tier === 'pro'}>{label}</span>

<style>
  .badge {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sx-pill);
    font-family: var(--sx-mono);
    font-size: 12px;
    color: var(--sx-ink-2);
  }

  .pro {
    background: var(--sx-tint-accent);
    color: var(--sx-accent-soft);
  }
</style>
