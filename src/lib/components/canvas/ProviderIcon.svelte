<script lang="ts">
  import {
    siAnthropic,
    siGoogle,
    siBytedance,
    siQwen,
    siMistralai,
    siPerplexity,
    siDeepseek,
    siKuaishou,
    siMinimax,
    type SimpleIcon
  } from 'simple-icons';

  let { provider, size = 12 }: { provider: string; size?: number } = $props();

  const PETAL_ANGLES = [0, 60, 120, 180, 240, 300];

  const ICON: Record<string, SimpleIcon> = {
    anthropic: siAnthropic,
    google: siGoogle,
    bytedance: siBytedance,
    'bytedance-seed': siBytedance,
    qwen: siQwen,
    mistralai: siMistralai,
    perplexity: siPerplexity,
    deepseek: siDeepseek,
    kuaishou: siKuaishou,
    minimax: siMinimax
  };

  const icon = $derived(ICON[provider]);
  const letter = $derived(provider.charAt(0).toUpperCase());
</script>

{#if provider === 'openai'}
  <svg class="provider-icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
    {#each PETAL_ANGLES as angle}
      <ellipse cx="12" cy="7" rx="3" ry="5" transform={`rotate(${angle} 12 12)`} />
    {/each}
  </svg>
{:else if icon}
  <svg class="provider-icon" viewBox="0 0 24 24" width={size} height={size} fill={`#${icon.hex}`} aria-hidden="true">
    <path d={icon.path} />
  </svg>
{:else}
  <span class="provider-letter" style={`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.66)}px`} aria-hidden="true">{letter}</span>
{/if}

<style>
  .provider-icon {
    flex: none;
    display: block;
  }

  .provider-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 12px;
    height: 12px;
    font-size: 8px;
    line-height: 1;
    font-weight: 600;
    color: var(--paper, #fff);
    background: var(--ink-soft, #6e6e73);
    border-radius: 0;
  }
</style>
