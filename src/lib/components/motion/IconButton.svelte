<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { ACTIONS, Caption, tipText, type ActionId } from '$lib/motion/actions';
  import { tip } from '$lib/motion/tooltip';

  type Props = Omit<HTMLButtonAttributes, 'class'> & {
    action: ActionId;
    label?: string;
    href?: string;
    size?: number;
    fill?: string;
    pressed?: boolean;
    caption?: Caption;
    class?: string;
  };

  let { action, label, href, size = 16, fill = 'none', pressed, caption = Caption.Never, class: extra = '', ...rest }: Props = $props();

  const spec = $derived(ACTIONS[action]);
  const name = $derived(label ?? spec.name);
  const text = $derived(tipText(action, name));
  const Icon = $derived(spec.icon);
</script>

{#if href}
  <a class={`ib ${extra}`} data-caption={caption} {href} aria-label={name} use:tip={text}><Icon {size} {fill} />{#if caption === Caption.Wide}<span class="caption">{name}</span>{/if}</a>
{:else}
  <button type="button" class={`ib ${extra}`} data-caption={caption} aria-label={name} aria-pressed={pressed} {...rest} use:tip={text}><Icon {size} {fill} />{#if caption === Caption.Wide}<span class="caption">{name}</span>{/if}</button>
{/if}

<style>
  .ib {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-shrink: 0;
    width: var(--ib-size, var(--ui-hit));
    height: var(--ib-size, var(--ui-hit));
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: none;
    color: var(--ui-ink-2);
    cursor: pointer;
    font: inherit;
    font-size: var(--ui-text-sm);
    white-space: nowrap;
  }

  .ib:hover:not(:disabled) {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .ib:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .ib:disabled {
    color: var(--ui-ink-3);
    cursor: default;
  }

  .ib[aria-pressed='true'] {
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
  }

  .caption {
    display: none;
  }

  @media (min-width: 1440px) {
    .ib[data-caption='wide'] {
      width: auto;
      padding: 0 var(--ui-space-3) 0 var(--ui-space-2);
    }

    .ib[data-caption='wide'] .caption {
      display: inline;
    }
  }

  :global(.ui-tip) {
    position: fixed;
    z-index: 1000;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 260px;
    padding: 5px 8px;
    background: var(--ui-raised);
    color: var(--ui-ink);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.16);
    font-family: inherit;
    font-size: var(--ui-text-xs);
    line-height: 1.3;
    pointer-events: none;
  }

  :global(.ui-tip kbd) {
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }
</style>
