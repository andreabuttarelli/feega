<script lang="ts">
  import { _ } from 'svelte-i18n';
  import './chat-pick.css';

  let { efforts, value, onchoose }: { efforts: string[]; value: string | null; onchoose: (effort: string) => void } = $props();
</script>

{#if efforts.length}
  <select name="reasoning" class="chat-pick effort" aria-label={$_('chat.panel.reasoning')} title={$_('chat.panel.reasoning')} value={value ?? ''} onchange={(e) => onchoose(e.currentTarget.value)}>
    {#each efforts as effort (effort)}
      <option value={effort} selected={effort === value}>{$_(`chat.panel.effort.${effort}`, { default: effort })}</option>
    {/each}
  </select>
{/if}

<style>
  .effort {
    flex: 0 0 auto;
  }
</style>
