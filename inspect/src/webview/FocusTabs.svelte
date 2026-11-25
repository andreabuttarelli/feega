<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Moon from '@lucide/svelte/icons/moon';
  import Sun from '@lucide/svelte/icons/sun';
  import { Scheme, View } from './focus';

  let { name, active, onselect, onclose, notice = null, scheme = null, onscheme, height = $bindable(0) }: { name: string; active: View; onselect: (view: View) => void; onclose: () => void; notice?: string | null; scheme?: Scheme | null; onscheme: (scheme: Scheme) => void; height?: number } = $props();
</script>

<div class="tabs" role="tablist" data-testid="focus-tabs" bind:clientHeight={height}>
  <button type="button" role="tab" aria-selected={active === View.Page} class:on={active === View.Page} data-testid="tab-page" onclick={() => onselect(View.Page)}>Page</button>
  <span class="tab" class:on={active === View.Focus}>
    <button type="button" role="tab" aria-selected={active === View.Focus} data-testid="tab-focus" onclick={() => onselect(View.Focus)}>{name}</button>
    <button type="button" class="close" data-testid="focus-exit" title="Close (Esc)" aria-label="Close {name}" onclick={onclose}><X size={11} /></button>
  </span>
  {#if notice}<span class="notice" data-testid="focus-notice">{notice}</span>{/if}
  {#if scheme}
    <button type="button" class="scheme" class:push={!notice} data-testid="focus-scheme" data-scheme={scheme} title={scheme === Scheme.Dark ? 'Showing the dark theme' : 'Showing the light theme'} aria-label="Switch between light and dark" onclick={() => onscheme(scheme === Scheme.Dark ? Scheme.Light : Scheme.Dark)}>
      {#if scheme === Scheme.Dark}<Moon size={13} />{:else}<Sun size={13} />{/if}
    </button>
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    padding: 4px 8px 0;
    background: var(--ui-chrome, var(--ui-float));
    box-shadow: inset 0 -1px 0 var(--ui-divider);
    font-size: var(--ui-text-xs);
  }

  button {
    border: 0;
    background: transparent;
    color: var(--ui-text-muted, inherit);
    font: inherit;
    cursor: default;
  }

  .tabs > button,
  .tab {
    display: flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  }

  .tab {
    gap: 4px;
    padding-right: 4px;
  }

  .tab > button:first-child {
    height: 100%;
    padding: 0;
    font-weight: 600;
  }

  .on {
    background: var(--ui-bg, var(--ui-float));
    color: var(--ui-text);
    box-shadow: inset 0 0 0 1px var(--ui-divider), 0 1px 0 var(--ui-bg, var(--ui-float));
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--ui-radius-sm, 4px);
    color: inherit;
  }

  .notice {
    align-self: center;
    margin-left: auto;
    padding-bottom: 4px;
    color: var(--ui-text-muted, inherit);
  }

  .scheme {
    display: flex;
    align-items: center;
    align-self: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    margin-bottom: 4px;
    margin-left: 6px;
    border-radius: var(--ui-radius-sm, 4px);
    color: var(--ui-text);
  }

  .scheme.push {
    margin-left: auto;
  }

  .scheme:hover,
  .close:hover {
    background: var(--ui-divider);
  }
</style>
